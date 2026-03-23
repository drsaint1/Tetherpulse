import { eq, and, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { walletService } from './wallet-service';
import { tipService } from './tip-service';
import type { Asset } from '../config/chains';
import { formatAmount } from '../utils/formatting';
import { createLogger } from '../utils/logger';

const log = createLogger('pool-service');

export class PoolService {
  /**
   * Create a new tip pool / bounty
   */
  async createPool(
    platform: string, platformId: string, username: string,
    chatId: string, title: string, targetAmount: number, asset: Asset = 'USDT',
  ): Promise<string> {
    const db = getDb();
    const wallet = await walletService.getOrCreateWallet(platform, platformId, username);

    // Expires in 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [pool] = await db.insert(schema.tipPools).values({
      creatorId: wallet.userId,
      chatId,
      title,
      targetAmount: targetAmount.toString(),
      asset,
      expiresAt,
    }).returning();

    log.info({ poolId: pool.id, title, target: targetAmount }, 'Pool created');

    return `🏆 *Bounty #${pool.id} Created!*\n\n` +
      `"${title}"\n` +
      `Target: ${formatAmount(targetAmount, asset)}\n` +
      `Status: 0 / ${formatAmount(targetAmount, asset)} funded\n` +
      `Expires: 7 days\n\n` +
      `Fund it: \`/pool fund ${pool.id} <amount>\`\n` +
      `Claim it: \`/pool claim ${pool.id}\``;
  }

  /**
   * Fund a pool
   */
  async fundPool(
    platform: string, platformId: string, username: string,
    poolId: number, amount: number,
  ): Promise<string> {
    const db = getDb();
    const wallet = await walletService.getOrCreateWallet(platform, platformId, username);

    const pool = await db.query.tipPools.findFirst({
      where: eq(schema.tipPools.id, poolId),
    });

    if (!pool) return `Pool #${poolId} not found.`;
    if (pool.status !== 'open') return `Pool #${poolId} is ${pool.status} — can't fund.`;

    // Record contribution
    await db.insert(schema.poolContributions).values({
      poolId,
      userId: wallet.userId,
      amount: amount.toString(),
    });

    // Update pool total
    const newTotal = parseFloat(pool.currentAmount) + amount;
    const newStatus = newTotal >= parseFloat(pool.targetAmount) ? 'funded' : 'open';

    await db.update(schema.tipPools)
      .set({
        currentAmount: newTotal.toString(),
        status: newStatus,
      })
      .where(eq(schema.tipPools.id, poolId));

    const statusEmoji = newStatus === 'funded' ? '✅' : '📊';
    return `${statusEmoji} *Pool #${poolId} Funded!*\n\n` +
      `@${username} added ${formatAmount(amount, pool.asset as Asset)}\n` +
      `Progress: ${formatAmount(newTotal, pool.asset as Asset)} / ${formatAmount(parseFloat(pool.targetAmount), pool.asset as Asset)}\n` +
      (newStatus === 'funded' ? `\n🎉 Bounty is fully funded! Someone can claim it now.` : '');
  }

  /**
   * Claim a bounty pool
   */
  async claimPool(
    platform: string, platformId: string, username: string,
    poolId: number,
  ): Promise<string> {
    const db = getDb();
    const wallet = await walletService.getOrCreateWallet(platform, platformId, username);

    const pool = await db.query.tipPools.findFirst({
      where: eq(schema.tipPools.id, poolId),
    });

    if (!pool) return `Pool #${poolId} not found.`;
    if (pool.status === 'claimed') return `Pool #${poolId} has already been claimed.`;
    if (pool.status === 'expired') return `Pool #${poolId} has expired.`;
    if (pool.creatorId === wallet.userId) return `You can't claim your own bounty.`;

    const poolAmount = parseFloat(pool.currentAmount);
    if (poolAmount <= 0) return `Pool #${poolId} has no funds yet.`;

    // Mark as claimed
    await db.update(schema.tipPools)
      .set({ status: 'claimed', claimedBy: wallet.userId })
      .where(eq(schema.tipPools.id, poolId));

    log.info({ poolId, claimedBy: wallet.userId, amount: poolAmount }, 'Pool claimed');

    return `🏆 *Bounty #${poolId} Claimed!*\n\n` +
      `"${pool.title}"\n` +
      `@${username} claimed ${formatAmount(poolAmount, pool.asset as Asset)}!\n\n` +
      `The pooled funds will be transferred to your wallet.`;
  }

  /**
   * List active pools for a chat
   */
  async listPools(chatId: string): Promise<string> {
    const db = getDb();
    const pools = await db.select()
      .from(schema.tipPools)
      .where(and(
        eq(schema.tipPools.chatId, chatId),
        sql`${schema.tipPools.status} IN ('open', 'funded')`,
      ))
      .limit(10);

    if (pools.length === 0) {
      return '🏆 *Active Bounties*\n\nNo active bounties. Create one:\n`/pool create "Description" 10 USDT`';
    }

    let response = '🏆 *Active Bounties*\n\n';
    for (const p of pools) {
      const progress = parseFloat(p.currentAmount);
      const target = parseFloat(p.targetAmount);
      const pct = Math.round((progress / target) * 100);
      const bar = '▓'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      response += `*#${p.id}:* ${p.title}\n`;
      response += `  ${bar} ${formatAmount(progress, p.asset as Asset)} / ${formatAmount(target, p.asset as Asset)} (${pct}%)\n`;
      response += `  ${p.status === 'funded' ? '✅ Ready to claim!' : '📊 Accepting funds'}\n\n`;
    }
    return response;
  }
}

export const poolService = new PoolService();
