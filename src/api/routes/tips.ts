import type { FastifyInstance } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '../../db/client';

export async function tipRoutes(app: FastifyInstance) {
  app.get('/api/tips', async (req) => {
    const { chatId, limit, offset } = req.query as any;
    const db = getDb();

    const conditions = chatId ? sql`${schema.tips.chatId} = ${chatId}` : sql`1=1`;

    const tips = await db.select({
      id: schema.tips.id,
      senderUsername: schema.users.username,
      amount: schema.tips.amount,
      asset: schema.tips.asset,
      chain: schema.tips.chain,
      txHash: schema.tips.txHash,
      status: schema.tips.status,
      aiSuggested: schema.tips.aiSuggested,
      createdAt: schema.tips.createdAt,
    })
      .from(schema.tips)
      .innerJoin(schema.users, eq(schema.tips.senderId, schema.users.id))
      .where(conditions)
      .orderBy(desc(schema.tips.createdAt))
      .limit(parseInt(limit) || 50)
      .offset(parseInt(offset) || 0);

    return { data: tips };
  });

  app.get('/api/stats', async () => {
    const db = getDb();

    const stats = await db.select({
      totalTips: sql<number>`count(*)`,
      totalVolume: sql<string>`coalesce(sum(amount::numeric), 0)`,
      uniqueSenders: sql<number>`count(distinct sender_id)`,
      uniqueReceivers: sql<number>`count(distinct receiver_id)`,
    }).from(schema.tips)
      .where(eq(schema.tips.status, 'confirmed'));

    return {
      data: {
        totalTips: Number(stats[0]?.totalTips ?? 0),
        totalVolume: parseFloat(stats[0]?.totalVolume ?? '0'),
        uniqueSenders: Number(stats[0]?.uniqueSenders ?? 0),
        uniqueReceivers: Number(stats[0]?.uniqueReceivers ?? 0),
      },
    };
  });
}
