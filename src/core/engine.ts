import { aiService } from './ai-service';
import { tipService, type TipResult } from './tip-service';
import { walletService } from './wallet-service';
import { leaderboardService } from './leaderboard-service';
import { pulseService } from './pulse-service';
import { autoTipService } from './autotip-service';
import { yieldService } from './yield-service';
import { poolService } from './pool-service';
import { streakService } from './streak-service';
import { faucetService } from './faucet-service';
import { getDb, schema } from '../db/client';
import { eq } from 'drizzle-orm';
import type { ChatMessage, PlatformAdapter, TipSuggestion } from '../adapters/types';
import type { Asset, ChainId } from '../config/chains';
import { formatAmount } from '../utils/formatting';
import { createLogger } from '../utils/logger';

const log = createLogger('engine');

export class Engine {
  private adapters = new Map<string, PlatformAdapter>();
  private messageCounter = new Map<string, number>(); // chatId -> count for sampling

  registerAdapter(adapter: PlatformAdapter) {
    this.adapters.set(adapter.platform, adapter);
    log.info({ platform: adapter.platform }, 'Adapter registered');
  }

  getAdapter(platform: string): PlatformAdapter | undefined {
    return this.adapters.get(platform);
  }

  /**
   * Process an incoming chat message — check for tip intent + contribution scoring.
   * Returns a reply string if there's something to say, null otherwise.
   */
  async handleMessage(msg: ChatMessage): Promise<string | null> {
    try {
      // 1. Try to parse tip intent
      log.debug({ text: msg.text, user: msg.username }, 'Processing message');
      const tipIntent = await aiService.parseTipIntent(msg.text, msg.username);

      if (tipIntent) {
        log.info({ tipIntent }, 'Tip intent detected');

        if (!tipIntent.recipient) {
          return '💡 Who do you want to tip? Try: "tip @username 5 USDT"';
        }

        const result = await tipService.executeTip({
          senderPlatform: msg.platform,
          senderPlatformId: msg.userId,
          senderUsername: msg.username,
          recipientUsername: tipIntent.recipient,
          amount: tipIntent.amount,
          asset: tipIntent.asset,
          chatId: msg.chatId,
          messageContext: msg.text,
        });

        return result.message;
      }

      // 2. Contribution scoring (sampled, for longer messages in group chats)
      if (this.shouldScoreMessage(msg)) {
        await this.scoreAndSuggest(msg);
      }

      // 3. Conversational reply — respond to all direct messages
      const reply = await aiService.chatReply(msg.text, msg.username);
      return reply;
    } catch (error) {
      log.error({ error, text: msg.text }, 'Error handling message');
      return null;
    }
  }

  /**
   * Handle explicit /tip command
   */
  async handleTipCommand(
    platform: string,
    platformId: string,
    username: string,
    recipient: string,
    amount: number,
    asset: Asset,
    chatId: string,
  ): Promise<TipResult> {
    return tipService.executeTip({
      senderPlatform: platform,
      senderPlatformId: platformId,
      senderUsername: username,
      recipientUsername: recipient,
      amount,
      asset,
      chatId,
    });
  }

  /**
   * Handle /balance command
   */
  async handleBalanceCommand(platform: string, platformId: string, username: string): Promise<string> {
    const wallet = await walletService.getOrCreateWallet(platform, platformId, username);

    const [usdtBalances, xautBalances] = await Promise.all([
      walletService.getBalances(wallet.userId, 'USDT'),
      walletService.getBalances(wallet.userId, 'XAUT'),
    ]);

    let response = '💰 *Your Balances*\n\n';

    response += '*USDt:*\n';
    for (const b of usdtBalances) {
      response += `  ${b.chain.toUpperCase()}: ${formatAmount(b.balance, 'USDT')}\n`;
    }

    response += '\n*XAU₮:*\n';
    for (const b of xautBalances) {
      response += `  ${b.chain.toUpperCase()}: ${formatAmount(b.balance, 'XAUT')}\n`;
    }

    // Show addresses
    response += '\n*Deposit Addresses:*\n';
    for (const [chain, address] of wallet.addresses) {
      response += `  ${chain.toUpperCase()}: \`${address}\`\n`;
    }

    return response;
  }

  /**
   * Handle /leaderboard command
   */
  async handleLeaderboardCommand(chatId?: string): Promise<string> {
    const [tippers, receivers] = await Promise.all([
      leaderboardService.getTopTippers(chatId, 5),
      leaderboardService.getTopReceivers(chatId, 5),
    ]);

    let response = '🏆 *Leaderboard*\n\n';

    response += '*Top Tippers:*\n';
    if (tippers.length === 0) {
      response += '  No tips yet!\n';
    } else {
      for (const t of tippers) {
        const medal = t.rank <= 3 ? ['🥇', '🥈', '🥉'][t.rank - 1] : `${t.rank}.`;
        response += `  ${medal} @${t.username} — ${formatAmount(t.totalAmount, 'USDT')} (${t.tipCount} tips)\n`;
      }
    }

    response += '\n*Top Receivers:*\n';
    if (receivers.length === 0) {
      response += '  No tips received yet!\n';
    } else {
      for (const r of receivers) {
        const medal = r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : `${r.rank}.`;
        response += `  ${medal} @${r.username} — ${formatAmount(r.totalAmount, 'USDT')} (${r.tipCount} tips)\n`;
      }
    }

    return response;
  }

  /**
   * Handle /reputation command — now with streaks, badges & cross-group reputation
   */
  async handleReputationCommand(platform: string, platformId: string, username: string): Promise<string> {
    const wallet = await walletService.getOrCreateWallet(platform, platformId, username);
    const rep = await leaderboardService.getReputation(wallet.userId);
    const streak = await streakService.getStreak(wallet.userId);

    if (!rep) return 'Could not calculate reputation.';

    const adjustedScore = Math.round(rep.reputationScore * streak.reputationMultiplier);

    let response = `⭐ *Reputation for @${rep.username}*\n\n`;
    response += `Score: *${adjustedScore}*`;
    if (streak.reputationMultiplier > 1) {
      response += ` (${streak.reputationMultiplier.toFixed(1)}x streak bonus!)`;
    }
    response += '\n';
    response += `Tips Sent: ${rep.tipsSent} (${formatAmount(rep.totalSent, 'USDT')})\n`;
    response += `Tips Received: ${rep.tipsReceived} (${formatAmount(rep.totalReceived, 'USDT')})\n`;
    response += `Avg Contribution: ${rep.avgContributionScore}/100\n\n`;

    // Streak info
    if (streak.currentStreak > 0) {
      response += `🔥 *Streak:* ${streak.currentStreak} day${streak.currentStreak > 1 ? 's' : ''} | Best: ${streak.longestStreak}\n`;
    }
    response += `📅 Total tip days: ${streak.totalTipDays}\n`;

    // Badges
    if (streak.badges.length > 0) {
      response += `\n*Badges:*\n`;
      for (const b of streak.badges) {
        response += `  ${b.emoji} ${b.label}\n`;
      }
    }

    response += `\n_Reputation is portable across all TetherPulse groups_`;
    return response;
  }

  /**
   * Handle /yield command
   */
  async handleYieldCommand(platform: string, platformId: string, username: string, args: string): Promise<string> {
    const wallet = await walletService.getOrCreateWallet(platform, platformId, username);

    if (!args || args === 'info') {
      const info = await yieldService.getYieldInfo(wallet.userId);
      const availableChains = yieldService.getAvailableChains();

      let response = `📈 *Yield Dashboard*\n\n`;
      if (info.totalDeposited > 0) {
        response += `Total earning yield: *$${info.totalDeposited.toFixed(2)} USDT*\n`;
        response += `Estimated APY: ~4-5%\n\n`;
        for (const c of info.chains) {
          response += `  ${c.chain.toUpperCase()}: $${c.amount.toFixed(2)} in Aave V3\n`;
        }
      } else {
        response += `No active yield deposits.\n`;
      }
      response += `\n*Available chains:* ${availableChains.map(c => c.toUpperCase()).join(', ')}\n\n`;
      response += `Deposit: \`/yield deposit 10 polygon\`\n`;
      response += `Withdraw: \`/yield withdraw 10 polygon\`\n`;
      response += `\n_Idle USDT earns ~4-5% APY via Aave V3_`;
      return response;
    }

    // /yield deposit <amount> [chain]
    const depositMatch = args.match(/^deposit\s+(\d+\.?\d*)\s*(\w+)?/i);
    if (depositMatch) {
      const amount = parseFloat(depositMatch[1]);
      const chain = (depositMatch[2]?.toLowerCase() || 'polygon') as ChainId;
      const result = await yieldService.deposit(wallet.userId, chain, amount);
      return result.message;
    }

    // /yield withdraw <amount> [chain]
    const withdrawMatch = args.match(/^withdraw\s+(\d+\.?\d*)\s*(\w+)?/i);
    if (withdrawMatch) {
      const amount = parseFloat(withdrawMatch[1]);
      const chain = (withdrawMatch[2]?.toLowerCase() || 'polygon') as ChainId;
      const result = await yieldService.withdraw(wallet.userId, chain, amount);
      return result.message;
    }

    return 'Usage:\n`/yield` — view yield dashboard\n`/yield deposit 10 polygon` — deposit to Aave\n`/yield withdraw 10 polygon` — withdraw from Aave';
  }

  /**
   * Handle /pool command
   */
  async handlePoolCommand(platform: string, platformId: string, username: string, chatId: string, args: string): Promise<string> {
    if (!args || args === 'list') {
      return poolService.listPools(chatId);
    }

    // /pool create "title" amount [asset]
    const createMatch = args.match(/^create\s+"([^"]+)"\s+(\d+\.?\d*)\s*(USDT|XAUT)?/i);
    if (createMatch) {
      const title = createMatch[1];
      const amount = parseFloat(createMatch[2]);
      const asset = (createMatch[3]?.toUpperCase() || 'USDT') as Asset;
      return poolService.createPool(platform, platformId, username, chatId, title, amount, asset);
    }

    // /pool fund <id> <amount>
    const fundMatch = args.match(/^fund\s+(\d+)\s+(\d+\.?\d*)/);
    if (fundMatch) {
      const poolId = parseInt(fundMatch[1]);
      const amount = parseFloat(fundMatch[2]);
      return poolService.fundPool(platform, platformId, username, poolId, amount);
    }

    // /pool claim <id>
    const claimMatch = args.match(/^claim\s+(\d+)/);
    if (claimMatch) {
      const poolId = parseInt(claimMatch[1]);
      return poolService.claimPool(platform, platformId, username, poolId);
    }

    return '🏆 *Tip Pools / Bounties*\n\n' +
      '`/pool` — list active bounties\n' +
      '`/pool create "Fix the navbar" 10 USDT` — create bounty\n' +
      '`/pool fund 1 5` — fund pool #1 with 5 USDT\n' +
      '`/pool claim 1` — claim bounty #1';
  }

  /**
   * Handle /faucet command — mint test tokens on testnet
   */
  async handleFaucetCommand(platform: string, platformId: string, username: string, args: string): Promise<string> {
    const wallet = await walletService.getOrCreateWallet(platform, platformId, username);

    if (!args || args === 'info') {
      return faucetService.getWalletInfo(wallet.userId);
    }

    // /faucet mint [amount]
    const mintMatch = args.match(/^mint\s*(\d+)?/);
    if (mintMatch) {
      const amount = mintMatch[1] ? parseInt(mintMatch[1]) : 100;
      return faucetService.mintTestTokens(wallet.userId, 'arbitrum', amount);
    }

    return 'Usage:\n`/faucet` — view wallet & faucet info\n`/faucet mint` — mint 100 test USDT\n`/faucet mint 500` — mint custom amount';
  }

  /**
   * Handle emoji-reaction tip (💰 reaction → auto-tip)
   */
  async handleReactionTip(
    platform: string, reactorPlatformId: string, reactorUsername: string,
    authorPlatformId: string, authorUsername: string, chatId: string,
  ): Promise<TipResult> {
    // Don't self-tip
    if (reactorPlatformId === authorPlatformId) {
      return { success: false, message: 'Cannot tip yourself via reaction.' };
    }

    return tipService.executeTip({
      senderPlatform: platform,
      senderPlatformId: reactorPlatformId,
      senderUsername: reactorUsername,
      recipientUsername: authorUsername,
      amount: 1, // Default reaction tip = 1 USDT
      asset: 'USDT',
      chatId,
      messageContext: 'reaction_tip',
    });
  }

  /**
   * Handle /pulse command — community health analytics
   */
  async handlePulseCommand(chatId: string): Promise<string> {
    const pulse = await pulseService.getPulse(chatId);

    const healthBar = this.renderHealthBar(pulse.healthScore);

    let response = `📊 *Community Pulse*\n\n`;
    response += `${healthBar} *${pulse.healthScore}/100*\n`;
    response += `_${pulse.summary}_\n\n`;

    response += `*Last 24h:*\n`;
    response += `  Tips: ${pulse.tipCount24h} | Volume: $${pulse.totalVolume24h.toFixed(2)}\n`;
    response += `  Tippers: ${pulse.uniqueTippers24h} | Receivers: ${pulse.uniqueReceivers24h}\n\n`;

    response += `*Last 7d:*\n`;
    response += `  Tips: ${pulse.tipCount7d} | Volume: $${pulse.totalVolume7d.toFixed(2)}\n\n`;

    if (pulse.topContributors.length > 0) {
      response += `*Top Contributors:*\n`;
      for (const c of pulse.topContributors) {
        response += `  ⭐ @${c.username} — score ${c.score}\n`;
      }
      response += '\n';
    }

    if (pulse.topTippers.length > 0) {
      response += `*Most Generous:*\n`;
      for (const t of pulse.topTippers) {
        response += `  💎 @${t.username} — $${t.amount.toFixed(2)} (${t.count} tips)\n`;
      }
      response += '\n';
    }

    if (pulse.topReceivers.length > 0) {
      response += `*Most Appreciated:*\n`;
      for (const r of pulse.topReceivers) {
        response += `  🏆 @${r.username} — $${r.amount.toFixed(2)} (${r.count} tips)\n`;
      }
      response += '\n';
    }

    response += `👥 ${pulse.totalUsers} registered | ${pulse.activeUsers24h} active today\n\n`;
    response += `🌐 _Full dashboard at your bot's web URL_`;

    return response;
  }

  private renderHealthBar(score: number): string {
    const filled = Math.round(score / 10);
    const empty = 10 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Handle AI-suggested tip acceptance (from inline button callback)
   */
  async handleSuggestedTipAccept(
    platform: string,
    platformId: string,
    username: string,
    recipientUsername: string,
    amount: number,
    asset: Asset,
    chatId: string,
  ): Promise<TipResult> {
    return tipService.executeTip({
      senderPlatform: platform,
      senderPlatformId: platformId,
      senderUsername: username,
      recipientUsername: recipientUsername,
      amount,
      asset,
      chatId,
      aiSuggested: true,
    });
  }

  /**
   * Decide whether to score this message for contribution quality
   */
  private shouldScoreMessage(msg: ChatMessage): boolean {
    // Skip short messages, bot commands, and emoji-only
    if (msg.text.length < 30) return false;
    if (msg.text.startsWith('/')) return false;
    if (/^[\p{Emoji}\s]+$/u.test(msg.text)) return false;

    // Sample 1-in-5 messages in busy channels
    const key = msg.chatId;
    const count = (this.messageCounter.get(key) ?? 0) + 1;
    this.messageCounter.set(key, count);

    return count % 5 === 0;
  }

  /**
   * Score a message and suggest a tip if worthy
   */
  private async scoreAndSuggest(msg: ChatMessage): Promise<void> {
    const score = await aiService.scoreContribution(msg.text, msg.username);
    if (!score || score.score < 70) return;

    const db = getDb();

    // Ensure user exists
    const wallet = await walletService.getOrCreateWallet(msg.platform, msg.userId, msg.username);

    // Record contribution score
    await db.insert(schema.contributionScores).values({
      chatId: msg.chatId,
      userId: wallet.userId,
      messageText: msg.text.slice(0, 500),
      score: score.score,
      category: score.category,
    });

    // Fire auto-tip rules
    const autoResult = await autoTipService.checkAndExecute(
      msg.chatId, msg.userId, msg.username,
      score.score, score.category, msg.text,
    );

    // Suggest tip (manual)
    const suggested = aiService.getSuggestedTipAmount(score.score);
    const adapter = this.adapters.get(msg.platform);

    if (adapter) {
      // Show auto-tip results
      if (autoResult.fired) {
        for (const result of autoResult.results) {
          await adapter.sendMessage(msg.chatId, result);
        }
      }

      const suggestionText = `💡 Great contribution by @${msg.username}! ` +
        `"${score.reason}"\n\n` +
        `Suggested tip: ${formatAmount(suggested.amount, suggested.asset)}`;

      await adapter.sendMessage(msg.chatId, suggestionText, [
        {
          label: `Tip ${formatAmount(suggested.amount, suggested.asset)}`,
          callbackData: `tip_suggest:${msg.userId}:${msg.username}:${suggested.amount}:${suggested.asset}`,
        },
      ]);
    }

    log.info({
      username: msg.username,
      score: score.score,
      category: score.category,
      suggestedAmount: suggested.amount,
      autoTipsFired: autoResult.results.length,
    }, 'Tip suggestion generated');
  }

  /**
   * Handle /autotip command
   */
  async handleAutoTipCommand(
    platform: string, platformId: string, username: string,
    chatId: string, args: string,
  ): Promise<string> {
    const wallet = await walletService.getOrCreateWallet(platform, platformId, username);

    // /autotip — list rules
    if (!args || args === 'list') {
      const rules = await autoTipService.getUserRules(wallet.userId);
      if (rules.length === 0) {
        return '🤖 *Auto-Tip Rules*\n\nNo rules set. Create one:\n`/autotip 1 USDT` — auto-tip 1 USDT for quality contributions\n`/autotip 2 USDT code` — only for code help\n`/autotip off 1` — disable rule #1';
      }

      let response = '🤖 *Your Auto-Tip Rules*\n\n';
      for (const rule of rules) {
        response += `#${rule.id}: ${rule.amount} ${rule.asset} | min score: ${rule.minScore}`;
        if (rule.category) response += ` | category: ${rule.category}`;
        response += ` | ${rule.tipsToday}/${rule.maxPerDay} today\n`;
      }
      return response;
    }

    // /autotip off <id> — disable rule
    const offMatch = args.match(/^off\s+(\d+)/);
    if (offMatch) {
      await autoTipService.deleteRule(parseInt(offMatch[1]), wallet.userId);
      return `Auto-tip rule #${offMatch[1]} disabled.`;
    }

    // /autotip <amount> [asset] [category]
    const createMatch = args.match(/^(\d+\.?\d*)\s*(USDT|XAUT)?\s*(.*)?/i);
    if (!createMatch) {
      return 'Usage: `/autotip 1 USDT` or `/autotip 2 USDT technical_help`';
    }

    const amount = parseFloat(createMatch[1]);
    const asset = (createMatch[2]?.toUpperCase() || 'USDT') as Asset;
    const category = createMatch[3]?.trim() || null;

    const rule = await autoTipService.createRule(
      wallet.userId, chatId, amount, asset, 70, category,
    );

    return `🤖 Auto-tip rule created!\n\n` +
      `#${rule.id}: Auto-tip ${amount} ${asset} when someone's contribution scores 70+` +
      (category ? ` in category "${category}"` : '') +
      `\nMax ${rule.maxPerDay} auto-tips per day.`;
  }
}

export const engine = new Engine();
