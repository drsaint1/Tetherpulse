import { sql, gte, eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { aiService } from './ai-service';
import { createLogger } from '../utils/logger';

const log = createLogger('pulse-service');

export interface PulseData {
  // Tip metrics
  tipCount24h: number;
  tipCount7d: number;
  totalVolume24h: number;
  totalVolume7d: number;
  uniqueTippers24h: number;
  uniqueReceivers24h: number;

  // Top contributors
  topContributors: { username: string; score: number }[];

  // Most generous
  topTippers: { username: string; amount: number; count: number }[];

  // Most appreciated
  topReceivers: { username: string; amount: number; count: number }[];

  // Activity
  totalUsers: number;
  activeUsers24h: number;

  // AI summary
  healthScore: number; // 0-100
  summary: string;
}

export class PulseService {
  async getPulse(chatId: string): Promise<PulseData> {
    const db = getDb();
    const now = new Date();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Tip stats - 24h
    const tips24h = await db.select({
      count: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(amount::numeric), 0)`,
      senders: sql<number>`count(distinct sender_id)`,
      receivers: sql<number>`count(distinct receiver_id)`,
    }).from(schema.tips)
      .where(sql`${schema.tips.chatId} = ${chatId} AND ${schema.tips.status} = 'confirmed' AND ${schema.tips.createdAt} >= ${day}`);

    // Tip stats - 7d
    const tips7d = await db.select({
      count: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(amount::numeric), 0)`,
    }).from(schema.tips)
      .where(sql`${schema.tips.chatId} = ${chatId} AND ${schema.tips.status} = 'confirmed' AND ${schema.tips.createdAt} >= ${week}`);

    // Top contributors by AI score (24h)
    const topContributors = await db.select({
      username: schema.users.username,
      avgScore: sql<number>`avg(${schema.contributionScores.score})::int`,
    }).from(schema.contributionScores)
      .innerJoin(schema.users, eq(schema.contributionScores.userId, schema.users.id))
      .where(sql`${schema.contributionScores.chatId} = ${chatId} AND ${schema.contributionScores.createdAt} >= ${day}`)
      .groupBy(schema.users.username)
      .orderBy(desc(sql`avg(${schema.contributionScores.score})`))
      .limit(5);

    // Top tippers (24h)
    const topTippers = await db.select({
      username: schema.users.username,
      total: sql<string>`sum(${schema.tips.amount}::numeric)`,
      count: sql<number>`count(*)`,
    }).from(schema.tips)
      .innerJoin(schema.users, eq(schema.tips.senderId, schema.users.id))
      .where(sql`${schema.tips.chatId} = ${chatId} AND ${schema.tips.status} = 'confirmed' AND ${schema.tips.createdAt} >= ${day}`)
      .groupBy(schema.users.username)
      .orderBy(desc(sql`sum(${schema.tips.amount}::numeric)`))
      .limit(5);

    // Top receivers (24h)
    const topReceivers = await db.select({
      username: schema.users.username,
      total: sql<string>`sum(${schema.tips.amount}::numeric)`,
      count: sql<number>`count(*)`,
    }).from(schema.tips)
      .innerJoin(schema.users, eq(schema.tips.receiverId, schema.users.id))
      .where(sql`${schema.tips.chatId} = ${chatId} AND ${schema.tips.status} = 'confirmed' AND ${schema.tips.createdAt} >= ${day}`)
      .groupBy(schema.users.username)
      .orderBy(desc(sql`sum(${schema.tips.amount}::numeric)`))
      .limit(5);

    // Total users + active users
    const userStats = await db.select({
      total: sql<number>`count(*)`,
    }).from(schema.users);

    const activeUsers = await db.select({
      count: sql<number>`count(distinct sender_id) + count(distinct receiver_id)`,
    }).from(schema.tips)
      .where(sql`${schema.tips.chatId} = ${chatId} AND ${schema.tips.createdAt} >= ${day}`);

    const tipCount24h = Number(tips24h[0]?.count ?? 0);
    const totalVolume24h = parseFloat(tips24h[0]?.total ?? '0');
    const tipCount7d = Number(tips7d[0]?.count ?? 0);
    const totalVolume7d = parseFloat(tips7d[0]?.total ?? '0');

    // Calculate health score
    const healthScore = this.calculateHealthScore(
      tipCount24h, totalVolume24h,
      Number(tips24h[0]?.senders ?? 0),
      Number(tips24h[0]?.receivers ?? 0),
      topContributors.length,
    );

    // Generate AI summary
    const summary = await this.generatePulseSummary(chatId, {
      tipCount24h, totalVolume24h, tipCount7d, totalVolume7d,
      healthScore,
      topContributorNames: topContributors.map(c => c.username),
      topTipperNames: topTippers.map(t => t.username),
    });

    return {
      tipCount24h,
      tipCount7d,
      totalVolume24h,
      totalVolume7d,
      uniqueTippers24h: Number(tips24h[0]?.senders ?? 0),
      uniqueReceivers24h: Number(tips24h[0]?.receivers ?? 0),
      topContributors: topContributors.map(c => ({ username: c.username, score: c.avgScore })),
      topTippers: topTippers.map(t => ({ username: t.username, amount: parseFloat(t.total), count: Number(t.count) })),
      topReceivers: topReceivers.map(r => ({ username: r.username, amount: parseFloat(r.total), count: Number(r.count) })),
      totalUsers: Number(userStats[0]?.total ?? 0),
      activeUsers24h: Number(activeUsers[0]?.count ?? 0),
      healthScore,
      summary,
    };
  }

  private calculateHealthScore(
    tips: number, volume: number, senders: number, receivers: number, contributors: number,
  ): number {
    // Weighted score based on activity indicators
    let score = 0;
    score += Math.min(tips * 5, 30);         // Up to 30 pts for tip count
    score += Math.min(volume * 2, 20);       // Up to 20 pts for volume
    score += Math.min(senders * 10, 20);     // Up to 20 pts for unique tippers
    score += Math.min(receivers * 10, 15);   // Up to 15 pts for unique receivers
    score += Math.min(contributors * 5, 15); // Up to 15 pts for quality contributors
    return Math.min(Math.round(score), 100);
  }

  private async generatePulseSummary(
    chatId: string,
    data: {
      tipCount24h: number; totalVolume24h: number;
      tipCount7d: number; totalVolume7d: number;
      healthScore: number;
      topContributorNames: string[];
      topTipperNames: string[];
    },
  ): Promise<string> {
    const genAI = (await import('@google/generative-ai')).GoogleGenerativeAI;
    const ai = new genAI(process.env.GEMINI_API_KEY!);
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Generate a 2-3 sentence community pulse summary. Be concise and insightful.

Stats:
- Health Score: ${data.healthScore}/100
- Tips (24h): ${data.tipCount24h} tips, $${data.totalVolume24h.toFixed(2)} volume
- Tips (7d): ${data.tipCount7d} tips, $${data.totalVolume7d.toFixed(2)} volume
- Top contributors: ${data.topContributorNames.join(', ') || 'None yet'}
- Top tippers: ${data.topTipperNames.join(', ') || 'None yet'}

If activity is low, encourage engagement. If high, celebrate it. Keep it under 200 chars.`;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch {
      if (data.healthScore > 60) return 'Community is thriving with active tipping and quality contributions!';
      if (data.healthScore > 30) return 'Community is warming up. Keep sharing knowledge and tipping great contributions!';
      return 'Community is just getting started. Be the first to tip a helpful member!';
    }
  }
}

export const pulseService = new PulseService();
