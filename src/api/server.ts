import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getEnv } from '../config/env';
import { leaderboardRoutes } from './routes/leaderboard';
import { tipRoutes } from './routes/tips';
import { pulseRoutes } from './routes/pulse';
import { dashboardHtml } from './dashboard';
import { createLogger } from '../utils/logger';

const log = createLogger('api');

export async function startApiServer() {
  const env = getEnv();
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Dashboard
  app.get('/', async (_, reply) => {
    reply.type('text/html').send(dashboardHtml);
  });

  // Routes
  await app.register(leaderboardRoutes);
  await app.register(tipRoutes);
  await app.register(pulseRoutes);

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  log.info({ port: env.PORT }, 'API server started');
  console.log(`\n  🌐 Dashboard: http://localhost:${env.PORT}/\n`);

  return app;
}
