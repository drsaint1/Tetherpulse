import { sql, gte, eq } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { aiService } from './ai-service';
import { leaderboardService } from './leaderboard-service';
import { createLogger } from '../utils/logger';

const log = createLogger('digest-service');

export class DigestService {
  /**
   * Generate and store a daily digest for a chat
   */
  async generateDailyDigest(chatId: string, platform: string, chatName: string): Promise<string> {
    const db = getDb();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get tip stats for the day
    const tipStats = await db.select({
      count: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(amount::numeric), 0)`,
    }).from(schema.tips)
      .where(sql`${schema.tips.chatId} = ${chatId} AND ${schema.tips.status} = 'confirmed' AND ${schema.tips.createdAt} >= ${dayAgo}`);

    const tipCount = Number(tipStats[0]?.count ?? 0);
    const totalVolume = parseFloat(tipStats[0]?.total ?? '0');

    // Get top tippers and receivers
    const topTippers = await leaderboardService.getTopTippers(chatId, 3, 'day');
    const topReceivers = await leaderboardService.getTopReceivers(chatId, 3, 'day');

    // Get recent high-score contributions
    const contributions = await db.select({
      username: schema.users.username,
      messageText: schema.contributionScores.messageText,
    }).from(schema.contributionScores)
      .innerJoin(schema.users, eq(schema.contributionScores.userId, schema.users.id))
      .where(sql`${schema.contributionScores.chatId} = ${chatId} AND ${schema.contributionScores.createdAt} >= ${dayAgo} AND ${schema.contributionScores.score} >= 70`)
      .limit(10);

    // Generate digest via AI
    const digest = await aiService.generateDigest(
      chatName,
      contributions.map(c => ({ username: c.username, text: c.messageText })),
      {
        count: tipCount,
        totalVolume,
        topTippers: topTippers.map(t => `@${t.username}`),
        topReceivers: topReceivers.map(r => `@${r.username}`),
      },
    );

    // Store digest
    await db.insert(schema.dailyDigests).values({
      chatId,
      platform,
      content: digest,
      tipCount,
      totalVolume: totalVolume.toString(),
      date: new Date(),
    });

    log.info({ chatId, tipCount, totalVolume }, 'Daily digest generated');
    return digest;
  }
}

export const digestService = new DigestService();
