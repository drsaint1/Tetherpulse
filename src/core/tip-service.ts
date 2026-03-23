import { eq, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { walletService } from './wallet-service';
import { chainRouter } from './chain-router';
import { abuseGuard } from './abuse-guard';
import { wdkManager } from '../wallet/wdk-manager';
import { CHAIN_CONFIGS, type Asset } from '../config/chains';
import { streakService } from './streak-service';
import { createLogger } from '../utils/logger';
import { formatAmount } from '../utils/formatting';

const log = createLogger('tip-service');

export interface TipRequest {
  senderPlatform: string;
  senderPlatformId: string;
  senderUsername: string;
  recipientUsername: string;
  amount: number;
  asset: Asset;
  chatId: string;
  aiSuggested?: boolean;
  messageContext?: string;
}

export interface TipResult {
  success: boolean;
  message: string;
  txHash?: string;
  chain?: string;
  gasCost?: number;
}

export class TipService {
  async executeTip(request: TipRequest): Promise<TipResult> {
    const db = getDb();

    try {
      // 1. Get or create sender wallet
      const sender = await walletService.getOrCreateWallet(
        request.senderPlatform,
        request.senderPlatformId,
        request.senderUsername,
      );

      // 2. Find recipient by username
      const recipientUsername = request.recipientUsername.replace(/^@/, '');
      const recipient = await walletService.findUserByUsername(request.senderPlatform, recipientUsername);

      if (!recipient) {
        // Store as pending tip — the recipient can claim it after registering
        await db.insert(schema.tips).values({
          senderId: sender.userId,
          receiverId: sender.userId, // placeholder — will be updated on claim
          amount: request.amount.toString(),
          asset: request.asset,
          chain: 'pending',
          status: 'pending',
          aiSuggested: request.aiSuggested || false,
          messageContext: `PENDING_FOR:${recipientUsername}|${request.messageContext || ''}`,
          chatId: request.chatId,
        });

        return {
          success: true,
          message: `💰 Tip of ${formatAmount(request.amount, request.asset)} reserved for @${recipientUsername}!\n\n` +
            `@${recipientUsername} — start a chat with me to claim your tip! Just tap my name and press Start.`,
        };
      }

      // 3. Abuse checks
      const abuseCheck = await abuseGuard.checkTip(
        sender.userId,
        recipient.id,
        request.amount,
        request.asset,
        request.chatId,
      );

      if (!abuseCheck.allowed) {
        return { success: false, message: abuseCheck.reason! };
      }

      // 4. Find best chain route
      const route = await chainRouter.findBestRoute(
        await walletService.getUserSeed(sender.userId),
        request.asset,
        request.amount,
        sender.addresses,
      );

      if (!route) {
        return {
          success: false,
          message: `Insufficient ${request.asset} balance across all chains. Use /balance to check your funds.`,
        };
      }

      // 5. Get recipient address on the selected chain
      const recipientAddresses = await walletService.getUserAddresses(recipient.id);
      const recipientAddress = recipientAddresses.get(route.chain);

      if (!recipientAddress) {
        return {
          success: false,
          message: `Recipient doesn't have a ${CHAIN_CONFIGS[route.chain].name} address yet.`,
        };
      }

      // 6. Create pending tip record
      const [tipRecord] = await db.insert(schema.tips).values({
        senderId: sender.userId,
        receiverId: recipient.id,
        amount: request.amount.toString(),
        asset: request.asset,
        chain: route.chain,
        status: 'pending',
        aiSuggested: request.aiSuggested || false,
        messageContext: request.messageContext,
        chatId: request.chatId,
      }).returning();

      // 7. Execute transfer
      try {
        const tokenConfig = request.asset === 'USDT'
          ? CHAIN_CONFIGS[route.chain].usdt
          : CHAIN_CONFIGS[route.chain].xaut;

        if (!tokenConfig) {
          throw new Error(`${request.asset} not supported on ${route.chain}`);
        }

        const amountRaw = Math.floor(request.amount * Math.pow(10, tokenConfig.decimals)).toString();
        const senderSeed = await walletService.getUserSeed(sender.userId);

        const txHash = await wdkManager.transfer(
          senderSeed,
          route.chain,
          recipientAddress,
          amountRaw,
          tokenConfig.contract,
        );

        // 8. Update tip record with success
        await db.update(schema.tips)
          .set({
            txHash,
            gasCostUsd: route.estimatedGasUsd.toString(),
            status: 'confirmed',
          })
          .where(eq(schema.tips.id, tipRecord.id));

        log.info({
          tipId: tipRecord.id,
          chain: route.chain,
          amount: request.amount,
          asset: request.asset,
          txHash,
        }, 'Tip executed successfully');

        // Record streak + check for new badges
        const { newBadges } = await streakService.recordTip(sender.userId, request.amount, request.asset);

        const gasNote = route.estimatedGasUsd === 0
          ? ' (gasless)'
          : ` (gas: ~$${route.estimatedGasUsd.toFixed(4)})`;

        let message = `✅ *Tip Sent!*\n` +
          `${formatAmount(request.amount, request.asset)} → @${recipientUsername}\n` +
          `Chain: ${CHAIN_CONFIGS[route.chain].name}${gasNote}\n` +
          (txHash ? `TX: \`${txHash.slice(0, 10)}...${txHash.slice(-6)}\`` : '');

        if (newBadges.length > 0) {
          message += `\n\n🏅 *New Badge${newBadges.length > 1 ? 's' : ''}!*\n`;
          for (const badge of newBadges) {
            message += `  ${badge}\n`;
          }
        }

        return {
          success: true,
          message,
          txHash,
          chain: route.chain,
          gasCost: route.estimatedGasUsd,
        };
      } catch (txError) {
        // Update tip as failed
        await db.update(schema.tips)
          .set({ status: 'failed' })
          .where(eq(schema.tips.id, tipRecord.id));

        log.error({ error: txError, tipId: tipRecord.id }, 'Transfer failed');
        return {
          success: false,
          message: `Transfer failed. Please try again later.`,
        };
      }
    } catch (error) {
      log.error({ error, request }, 'Tip execution error');
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
      };
    }
  }
  /**
   * Check and claim pending tips for a newly registered user
   */
  async claimPendingTips(username: string, userId: number): Promise<string[]> {
    const db = getDb();
    const pendingTag = `PENDING_FOR:${username}|`;

    const pendingTips = await db.select()
      .from(schema.tips)
      .where(sql`${schema.tips.status} = 'pending' AND ${schema.tips.chain} = 'pending' AND ${schema.tips.messageContext} LIKE ${pendingTag + '%'}`);

    if (pendingTips.length === 0) return [];

    const results: string[] = [];

    for (const tip of pendingTips) {
      // Update receiver to the real user
      await db.update(schema.tips)
        .set({ receiverId: userId, status: 'confirmed', chain: 'claimed' })
        .where(eq(schema.tips.id, tip.id));

      results.push(`Claimed ${formatAmount(parseFloat(tip.amount), tip.asset as Asset)} tip!`);
    }

    log.info({ username, count: results.length }, 'Pending tips claimed');
    return results;
  }
}

export const tipService = new TipService();
