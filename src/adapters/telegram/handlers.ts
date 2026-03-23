import type { Context } from 'telegraf';
import { engine } from '../../core/engine';
import { tipService } from '../../core/tip-service';
import { walletService } from '../../core/wallet-service';
import type { ChatMessage, Platform } from '../types';
import type { Asset } from '../../config/chains';
import { createLogger } from '../../utils/logger';

const log = createLogger('telegram-handlers');
const PLATFORM: Platform = 'telegram';

function toChatMessage(ctx: Context): ChatMessage | null {
  const msg = ctx.message;
  if (!msg || !('text' in msg)) return null;

  return {
    platform: PLATFORM,
    chatId: msg.chat.id.toString(),
    messageId: msg.message_id.toString(),
    userId: msg.from!.id.toString(),
    username: msg.from!.username || msg.from!.first_name || 'unknown',
    text: msg.text,
    replyToUserId: (msg as any).reply_to_message?.from?.id?.toString(),
    replyToUsername: (msg as any).reply_to_message?.from?.username,
    timestamp: new Date(msg.date * 1000),
  };
}

export async function handleStart(ctx: Context) {
  try {
    const platformId = ctx.from!.id.toString();
    const username = ctx.from!.username || ctx.from!.first_name || 'unknown';

    const wallet = await engine.handleBalanceCommand(PLATFORM, platformId, username);

    let welcomeMsg = `Welcome to TetherPulse! Your wallet has been created.\n\n${wallet}`;

    // Check for pending tips
    const userRecord = await walletService.findUser(PLATFORM, platformId);
    if (userRecord) {
      const claimed = await tipService.claimPendingTips(username, userRecord.id);
      if (claimed.length > 0) {
        welcomeMsg += `\n\n🎉 *You have pending tips!*\n`;
        for (const c of claimed) {
          welcomeMsg += `  ${c}\n`;
        }
      }
    }

    await ctx.reply(welcomeMsg, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in /start');
    await ctx.reply('Something went wrong. Please try again.');
  }
}

export async function handleTipCommand(ctx: Context) {
  try {
    const msg = ctx.message;
    if (!msg || !('text' in msg)) return;

    // Parse: /tip @username amount [asset]
    const match = msg.text.match(/^\/tip\s+@?(\S+)\s+(\d+\.?\d*)\s*(USDT|XAUT|USDt|XAU₮)?/i);

    if (!match) {
      await ctx.reply('Usage: /tip @username amount [USDT|XAUT]\nExample: /tip @alice 5 USDT');
      return;
    }

    const recipient = match[1];
    const amount = parseFloat(match[2]);
    let asset: Asset = 'USDT';
    if (match[3] && (match[3].toUpperCase() === 'XAUT' || match[3] === 'XAU₮')) {
      asset = 'XAUT';
    }

    const result = await engine.handleTipCommand(
      PLATFORM,
      ctx.from!.id.toString(),
      ctx.from!.username || ctx.from!.first_name || 'unknown',
      recipient,
      amount,
      asset,
      msg.chat.id.toString(),
    );

    await ctx.reply(result.message, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in /tip');
    await ctx.reply('Something went wrong. Please try again.');
  }
}

export async function handleBalance(ctx: Context) {
  try {
    const response = await engine.handleBalanceCommand(
      PLATFORM,
      ctx.from!.id.toString(),
      ctx.from!.username || ctx.from!.first_name || 'unknown',
    );
    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in /balance');
    await ctx.reply('Something went wrong. Please try again.');
  }
}

export async function handleLeaderboard(ctx: Context) {
  try {
    const chatId = ctx.chat?.id.toString();
    const response = await engine.handleLeaderboardCommand(chatId);
    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in /leaderboard');
    await ctx.reply('Something went wrong. Please try again.');
  }
}

export async function handleReputation(ctx: Context) {
  try {
    const response = await engine.handleReputationCommand(
      PLATFORM,
      ctx.from!.id.toString(),
      ctx.from!.username || ctx.from!.first_name || 'unknown',
    );
    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in /reputation');
    await ctx.reply('Something went wrong. Please try again.');
  }
}

export async function handleAutoTip(ctx: Context) {
  try {
    const msg = ctx.message;
    if (!msg || !('text' in msg)) return;

    const args = msg.text.replace(/^\/autotip\s*/, '').trim();
    const response = await engine.handleAutoTipCommand(
      PLATFORM,
      ctx.from!.id.toString(),
      ctx.from!.username || ctx.from!.first_name || 'unknown',
      msg.chat.id.toString(),
      args,
    );
    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in /autotip');
    await ctx.reply('Something went wrong. Please try again.');
  }
}

export async function handlePulse(ctx: Context) {
  try {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;
    const response = await engine.handlePulseCommand(chatId);
    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in /pulse');
    await ctx.reply('Something went wrong. Please try again.');
  }
}

export async function handleFaucet(ctx: Context) {
  try {
    const msg = ctx.message;
    if (!msg || !('text' in msg)) return;

    const args = msg.text.replace(/^\/faucet\s*/, '').trim();
    const response = await engine.handleFaucetCommand(
      PLATFORM,
      ctx.from!.id.toString(),
      ctx.from!.username || ctx.from!.first_name || 'unknown',
      args,
    );
    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in /faucet');
    await ctx.reply('Something went wrong. Please try again.');
  }
}

export async function handleYield(ctx: Context) {
  try {
    const msg = ctx.message;
    if (!msg || !('text' in msg)) return;

    const args = msg.text.replace(/^\/yield\s*/, '').trim();
    const response = await engine.handleYieldCommand(
      PLATFORM,
      ctx.from!.id.toString(),
      ctx.from!.username || ctx.from!.first_name || 'unknown',
      args,
    );
    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in /yield');
    await ctx.reply('Something went wrong. Please try again.');
  }
}

export async function handlePool(ctx: Context) {
  try {
    const msg = ctx.message;
    if (!msg || !('text' in msg)) return;

    const args = msg.text.replace(/^\/pool\s*/, '').trim();
    const chatId = msg.chat.id.toString();
    const response = await engine.handlePoolCommand(
      PLATFORM,
      ctx.from!.id.toString(),
      ctx.from!.username || ctx.from!.first_name || 'unknown',
      chatId,
      args,
    );
    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in /pool');
    await ctx.reply('Something went wrong. Please try again.');
  }
}

export async function handleMessageReaction(ctx: Context) {
  try {
    const update = ctx.update as any;
    const reaction = update.message_reaction;
    if (!reaction) return;

    // Check if 💰 emoji was added
    const newReactions = reaction.new_reaction || [];
    const hasTipReaction = newReactions.some((r: any) =>
      (r.type === 'emoji' && r.emoji === '💰') ||
      (r.type === 'custom_emoji')
    );

    if (!hasTipReaction) return;

    // We need the original message author — Telegram provides it in reaction updates
    const reactorId = reaction.user?.id?.toString();
    const reactorUsername = reaction.user?.username || reaction.user?.first_name || 'unknown';

    // For reaction tips we need the original message author
    // Telegram message_reaction gives us the chat but not the original message author directly
    // We'll use the actor_chat for group context
    if (!reactorId) return;

    const chatId = reaction.chat.id.toString();

    // Try to get the original message to find the author
    // Note: Telegram doesn't always provide the original message in reaction events
    // This is a best-effort implementation
    log.info({ reactorId, reactorUsername, chatId }, 'Tip reaction detected');

    // We can't get the original message author from reaction events in Telegraf
    // So we'll notify the user to use /tip instead
    const adapter = engine.getAdapter(PLATFORM);
    if (adapter) {
      await adapter.sendMessage(chatId,
        `💰 @${reactorUsername} wants to tip! Reply to the message with \`/tip @username 1 USDT\` to send.`
      );
    }
  } catch (error) {
    log.error({ error }, 'Error handling reaction');
  }
}

export async function handleTextMessage(ctx: Context) {
  const chatMsg = toChatMessage(ctx);
  if (!chatMsg) return;

  // Don't process commands
  if (chatMsg.text.startsWith('/')) return;

  const reply = await engine.handleMessage(chatMsg);
  if (reply) {
    await ctx.reply(reply, { parse_mode: 'Markdown' });
  }
}

export async function handleCallbackQuery(ctx: Context) {
  try {
    const data = (ctx.callbackQuery as any)?.data;
    if (!data || !data.startsWith('tip_suggest:')) {
      await ctx.answerCbQuery();
      return;
    }

    // Parse: tip_suggest:recipientId:recipientUsername:amount:asset
    const parts = data.split(':');
    if (parts.length !== 5) {
      await ctx.answerCbQuery('Invalid action');
      return;
    }

    const [, recipientId, recipientUsername, amountStr, asset] = parts;
    const amount = parseFloat(amountStr);

    const result = await engine.handleSuggestedTipAccept(
      PLATFORM,
      ctx.from!.id.toString(),
      ctx.from!.username || ctx.from!.first_name || 'unknown',
      recipientUsername,
      amount,
      asset as Asset,
      (ctx.callbackQuery as any).message?.chat?.id?.toString() || '',
    );

    await ctx.answerCbQuery(result.success ? 'Tip sent!' : result.message);
    if (result.success) {
      await ctx.reply(result.message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    log.error({ error }, 'Error in callback query');
    await ctx.answerCbQuery('Something went wrong');
  }
}
