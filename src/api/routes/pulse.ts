import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { pulseService } from '../../core/pulse-service';
import { getDb, schema } from '../../db/client';

export async function pulseRoutes(app: FastifyInstance) {
  app.get('/api/pulse/:chatId', async (req) => {
    const { chatId } = req.params as any;
    const pulse = await pulseService.getPulse(chatId);
    return { data: pulse };
  });

  app.get('/api/pulse', async () => {
    const pulse = await pulseService.getPulse('');
    const db = getDb();

    // Extra stats for dashboard
    const [yieldStats] = await db.select({
      totalDeposited: sql<string>`coalesce(sum(amount::numeric), 0)`,
      depositors: sql<number>`count(distinct user_id)`,
    }).from(schema.yieldDeposits)
      .where(sql`${schema.yieldDeposits.status} = 'deposited'`);

    const [poolStats] = await db.select({
      activePools: sql<number>`count(*)`,
      totalPooled: sql<string>`coalesce(sum(current_amount::numeric), 0)`,
    }).from(schema.tipPools)
      .where(sql`${schema.tipPools.status} IN ('open', 'funded')`);

    return {
      data: {
        ...pulse,
        yieldTotalDeposited: parseFloat(yieldStats?.totalDeposited ?? '0'),
        yieldDepositors: Number(yieldStats?.depositors ?? 0),
        activePools: Number(poolStats?.activePools ?? 0),
        totalPooled: parseFloat(poolStats?.totalPooled ?? '0'),
      },
    };
  });
}
