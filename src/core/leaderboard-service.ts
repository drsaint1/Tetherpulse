import { sql, eq, gte, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { createLogger } from '../utils/logger';

const log = createLogger('leaderboard');

export interface LeaderboardEntry {
  userId: number;
  username: string;
  totalAmount: number;
  tipCount: number;
  rank: number;
}

export interface ReputationScore {
  userId: number;
  username: string;
  tipsSent: number;
  tipsReceived: number;
  totalSent: number;
  totalReceived: number;
  avgContributionScore: number;
  reputationScore: number;
}

export class LeaderboardService {
  /**
   * Get top tippers (by total amount sent)
   */
  async getTopTippers(chatId?: string, limit = 10, period: 'day' | 'week' | 'all' = 'all'): Promise<LeaderboardEntry[]> {
    const db = getDb();
    const since = this.getPeriodStart(period);

    const conditions = [
      eq(schema.tips.status, 'confirmed'),
      ...(since ? [gte(schema.tips.createdAt, since)] : []),
      ...(chatId ? [eq(schema.tips.chatId, chatId)] : []),
    ];

    const results = await db
      .select({
        userId: schema.tips.senderId,
        username: schema.users.username,
        totalAmount: sql<string>`sum(${schema.tips.amount}::numeric)`,
        tipCount: sql<number>`count(*)`,
      })
      .from(schema.tips)
      .innerJoin(schema.users, eq(schema.tips.senderId, schema.users.id))
      .where(sql`${schema.tips.status} = 'confirmed'${since ? sql` AND ${schema.tips.createdAt} >= ${since}` : sql``}${chatId ? sql` AND ${schema.tips.chatId} = ${chatId}` : sql``}`)
      .groupBy(schema.tips.senderId, schema.users.username)
      .orderBy(desc(sql`sum(${schema.tips.amount}::numeric)`))
      .limit(limit);

    return results.map((r, i) => ({
      userId: r.userId,
      username: r.username,
      totalAmount: parseFloat(r.totalAmount),
      tipCount: Number(r.tipCount),
      rank: i + 1,
    }));
  }

  /**
   * Get top receivers (by total amount received)
   */
  async getTopReceivers(chatId?: string, limit = 10, period: 'day' | 'week' | 'all' = 'all'): Promise<LeaderboardEntry[]> {
    const db = getDb();
    const since = this.getPeriodStart(period);

    const results = await db
      .select({
        userId: schema.tips.receiverId,
        username: schema.users.username,
        totalAmount: sql<string>`sum(${schema.tips.amount}::numeric)`,
        tipCount: sql<number>`count(*)`,
      })
      .from(schema.tips)
      .innerJoin(schema.users, eq(schema.tips.receiverId, schema.users.id))
      .where(sql`${schema.tips.status} = 'confirmed'${since ? sql` AND ${schema.tips.createdAt} >= ${since}` : sql``}${chatId ? sql` AND ${schema.tips.chatId} = ${chatId}` : sql``}`)
      .groupBy(schema.tips.receiverId, schema.users.username)
      .orderBy(desc(sql`sum(${schema.tips.amount}::numeric)`))
      .limit(limit);

    return results.map((r, i) => ({
      userId: r.userId,
      username: r.username,
      totalAmount: parseFloat(r.totalAmount),
      tipCount: Number(r.tipCount),
      rank: i + 1,
    }));
  }

  /**
   * Get reputation score for a user
   */
  async getReputation(userId: number): Promise<ReputationScore | null> {
    const db = getDb();

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });
    if (!user) return null;

    const sent = await db.select({
      count: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(amount::numeric), 0)`,
    }).from(schema.tips)
      .where(sql`${schema.tips.senderId} = ${userId} AND ${schema.tips.status} = 'confirmed'`);

    const received = await db.select({
      count: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(amount::numeric), 0)`,
    }).from(schema.tips)
      .where(sql`${schema.tips.receiverId} = ${userId} AND ${schema.tips.status} = 'confirmed'`);

    const avgScore = await db.select({
      avg: sql<string>`coalesce(avg(score), 0)`,
    }).from(schema.contributionScores)
      .where(eq(schema.contributionScores.userId, userId));

    const tipsSent = Number(sent[0]?.count ?? 0);
    const tipsReceived = Number(received[0]?.count ?? 0);
    const totalSent = parseFloat(sent[0]?.total ?? '0');
    const totalReceived = parseFloat(received[0]?.total ?? '0');
    const avgContrib = parseFloat(avgScore[0]?.avg ?? '0');

    // Reputation formula: weighted combination of activity and contribution quality
    const reputationScore = Math.round(
      (tipsSent * 2) + (tipsReceived * 3) + (avgContrib * 0.5) + (totalSent * 0.1)
    );

    return {
      userId,
      username: user.username,
      tipsSent,
      tipsReceived,
      totalSent,
      totalReceived,
      avgContributionScore: Math.round(avgContrib),
      reputationScore,
    };
  }

  private getPeriodStart(period: 'day' | 'week' | 'all'): Date | null {
    if (period === 'all') return null;
    const now = new Date();
    if (period === 'day') return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

export const leaderboardService = new LeaderboardService();
