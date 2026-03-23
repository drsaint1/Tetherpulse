import { eq, and, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { tipService } from './tip-service';
import { createLogger } from '../utils/logger';
import type { Asset } from '../config/chains';

const log = createLogger('autotip');

export interface AutoTipRule {
  id: number;
  amount: number;
  asset: string;
  minScore: number;
  category: string | null;
  maxPerDay: number;
  tipsToday: number;
  isActive: boolean;
}

export class AutoTipService {
  /**
   * Create a new auto-tip rule for a user in a chat
   */
  async createRule(
    userId: number,
    chatId: string,
    amount: number,
    asset: Asset = 'USDT',
    minScore = 70,
    category: string | null = null,
    maxPerDay = 5,
  ): Promise<AutoTipRule> {
    const db = getDb();

    const [rule] = await db.insert(schema.autoTipRules).values({
      userId,
      chatId,
      amount: amount.toString(),
      asset,
      minScore,
      category,
      maxPerDay,
    }).returning();

    log.info({ userId, chatId, amount, minScore }, 'Auto-tip rule created');

    return {
      id: rule.id,
      amount: parseFloat(rule.amount),
      asset: rule.asset,
      minScore: rule.minScore,
      category: rule.category,
      maxPerDay: rule.maxPerDay,
      tipsToday: rule.tipsToday,
      isActive: rule.isActive,
    };
  }

  /**
   * Get all active rules for a user
   */
  async getUserRules(userId: number): Promise<AutoTipRule[]> {
    const db = getDb();
    const rules = await db.query.autoTipRules.findMany({
      where: and(
        eq(schema.autoTipRules.userId, userId),
        eq(schema.autoTipRules.isActive, true),
      ),
    });

    return rules.map(r => ({
      id: r.id,
      amount: parseFloat(r.amount),
      asset: r.asset,
      minScore: r.minScore,
      category: r.category,
      maxPerDay: r.maxPerDay,
      tipsToday: r.tipsToday,
      isActive: r.isActive,
    }));
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId: number, userId: number): Promise<boolean> {
    const db = getDb();
    const result = await db.update(schema.autoTipRules)
      .set({ isActive: false })
      .where(and(
        eq(schema.autoTipRules.id, ruleId),
        eq(schema.autoTipRules.userId, userId),
      ));
    return true;
  }

  /**
   * Check if any auto-tip rules should fire for a scored contribution.
   * Called when a message scores >= 70. Executes matching rules.
   */
  async checkAndExecute(
    chatId: string,
    contributorPlatformId: string,
    contributorUsername: string,
    score: number,
    category: string,
    messagePreview: string,
  ): Promise<{ fired: boolean; results: string[] }> {
    const db = getDb();
    const results: string[] = [];

    // Find all active rules for this chat where score meets threshold
    const rules = await db.select({
      ruleId: schema.autoTipRules.id,
      userId: schema.autoTipRules.userId,
      amount: schema.autoTipRules.amount,
      asset: schema.autoTipRules.asset,
      minScore: schema.autoTipRules.minScore,
      category: schema.autoTipRules.category,
      maxPerDay: schema.autoTipRules.maxPerDay,
      tipsToday: schema.autoTipRules.tipsToday,
      platform: schema.users.platform,
      platformId: schema.users.platformId,
      username: schema.users.username,
    })
      .from(schema.autoTipRules)
      .innerJoin(schema.users, eq(schema.autoTipRules.userId, schema.users.id))
      .where(sql`${schema.autoTipRules.chatId} = ${chatId} AND ${schema.autoTipRules.isActive} = true AND ${schema.autoTipRules.minScore} <= ${score} AND ${schema.autoTipRules.tipsToday} < ${schema.autoTipRules.maxPerDay}`);

    for (const rule of rules) {
      // Skip if category doesn't match (null = any)
      if (rule.category && rule.category !== category) continue;

      // Skip self-tipping
      if (rule.platformId === contributorPlatformId) continue;

      try {
        const tipResult = await tipService.executeTip({
          senderPlatform: rule.platform,
          senderPlatformId: rule.platformId,
          senderUsername: rule.username,
          recipientUsername: contributorUsername,
          amount: parseFloat(rule.amount),
          asset: rule.asset as Asset,
          chatId,
          aiSuggested: true,
          messageContext: `Auto-tip: ${messagePreview.slice(0, 100)}`,
        });

        if (tipResult.success) {
          // Increment today's counter
          await db.update(schema.autoTipRules)
            .set({ tipsToday: sql`${schema.autoTipRules.tipsToday} + 1` })
            .where(eq(schema.autoTipRules.id, rule.ruleId));

          results.push(`🤖 Auto-tip from @${rule.username}: ${parseFloat(rule.amount)} ${rule.asset} → @${contributorUsername}`);
          log.info({ ruleId: rule.ruleId, from: rule.username, to: contributorUsername }, 'Auto-tip fired');
        }
      } catch (error) {
        log.error({ error, ruleId: rule.ruleId }, 'Auto-tip execution failed');
      }
    }

    return { fired: results.length > 0, results };
  }

  /**
   * Reset daily tip counters (called by cron at midnight)
   */
  async resetDailyCounters(): Promise<void> {
    const db = getDb();
    await db.update(schema.autoTipRules)
      .set({ tipsToday: 0 })
      .where(eq(schema.autoTipRules.isActive, true));
    log.info('Auto-tip daily counters reset');
  }
}

export const autoTipService = new AutoTipService();
