import type { FastifyInstance } from 'fastify';
import { leaderboardService } from '../../core/leaderboard-service';

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get('/api/leaderboard/tippers', async (req, reply) => {
    const { chatId, limit, period } = req.query as any;
    const tippers = await leaderboardService.getTopTippers(
      chatId,
      parseInt(limit) || 10,
      period || 'all',
    );
    return { data: tippers };
  });

  app.get('/api/leaderboard/receivers', async (req, reply) => {
    const { chatId, limit, period } = req.query as any;
    const receivers = await leaderboardService.getTopReceivers(
      chatId,
      parseInt(limit) || 10,
      period || 'all',
    );
    return { data: receivers };
  });

  app.get('/api/reputation/:userId', async (req, reply) => {
    const { userId } = req.params as any;
    const rep = await leaderboardService.getReputation(parseInt(userId));
    if (!rep) {
      reply.status(404);
      return { error: 'User not found' };
    }
    return { data: rep };
  });
}
