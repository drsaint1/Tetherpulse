import { eq, and, gte, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { getEnv } from '../config/env';
import { createLogger } from '../utils/logger';
import type { Asset } from '../config/chains';

const log = createLogger('abuse-guard');

export interface AbuseCheckResult {
  allowed: boolean;
  reason?: string;
}

export class AbuseGuard {
  /**
   * Run all abuse checks before allowing a tip
   */
  async checkTip(
    senderId: number,
    receiverId: number,
    amount: number,
    asset: Asset,
    chatId: string,
  ): Promise<AbuseCheckResult> {
    const env = getEnv();

    // 1. Self-tipping
    if (senderId === receiverId) {
      return { allowed: false, reason: 'You cannot tip yourself.' };
    }

    // 2. Banned check
    const db = getDb();
    const sender = await db.query.users.findFirst({
      where: eq(schema.users.id, senderId),
    });
    if (sender?.isBanned) {
      return { allowed: false, reason: 'Your account has been restricted.' };
    }

    // 3. Minimum tip amount
    if (asset === 'USDT' && amount < env.MIN_TIP_USDT) {
      return { allowed: false, reason: `Minimum tip is ${env.MIN_TIP_USDT} USDT.` };
    }
    if (asset === 'XAUT' && amount < env.MIN_TIP_XAUT) {
      return { allowed: false, reason: `Minimum tip is ${env.MIN_TIP_XAUT} XAUT.` };
    }

    // 4. Rate limit: tips per hour
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentTips = await db.select({ count: sql<number>`count(*)` })
      .from(schema.tips)
      .where(and(
        eq(schema.tips.senderId, senderId),
        gte(schema.tips.createdAt, hourAgo),
      ));

    const tipCount = Number(recentTips[0]?.count ?? 0);
    if (tipCount >= env.MAX_TIPS_PER_HOUR) {
      return { allowed: false, reason: `Rate limit: max ${env.MAX_TIPS_PER_HOUR} tips per hour.` };
    }

    // 5. Daily amount cap
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyTips = await db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
      .from(schema.tips)
      .where(and(
        eq(schema.tips.senderId, senderId),
        gte(schema.tips.createdAt, dayAgo),
        eq(schema.tips.status, 'confirmed'),
      ));

    const dailyTotal = parseFloat(dailyTips[0]?.total ?? '0');
    if (dailyTotal + amount > env.MAX_DAILY_AMOUNT_USD) {
      return { allowed: false, reason: `Daily limit: max $${env.MAX_DAILY_AMOUNT_USD} per day. You've sent $${dailyTotal.toFixed(2)} today.` };
    }

    // 6. New account restriction
    if (sender) {
      const accountAge = Date.now() - sender.createdAt.getTime();
      const hoursOld = accountAge / (1000 * 60 * 60);
      if (hoursOld < env.NEW_ACCOUNT_HOURS && dailyTotal + amount > env.NEW_ACCOUNT_MAX_USD) {
        return { allowed: false, reason: `New accounts are limited to $${env.NEW_ACCOUNT_MAX_USD} in tips for the first ${env.NEW_ACCOUNT_HOURS} hours.` };
      }
    }

    // 7. Circular tipping detection (A↔B > 3x in 24h)
    const circularTips = await db.select({ count: sql<number>`count(*)` })
      .from(schema.tips)
      .where(and(
        eq(schema.tips.senderId, receiverId),
        eq(schema.tips.receiverId, senderId),
        gte(schema.tips.createdAt, dayAgo),
        eq(schema.tips.status, 'confirmed'),
      ));

    const circularCount = Number(circularTips[0]?.count ?? 0);
    if (circularCount >= 3) {
      return { allowed: false, reason: 'Circular tipping detected. Please avoid exchanging tips repeatedly with the same user.' };
    }

    log.debug({ senderId, receiverId, amount, asset }, 'Abuse check passed');
    return { allowed: true };
  }
}

export const abuseGuard = new AbuseGuard();
