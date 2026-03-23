import { getEnv } from './config/env';
import { wdkManager } from './wallet/wdk-manager';
import { TelegramBot } from './adapters/telegram/bot';
import { startApiServer } from './api/server';
import { startCronJobs } from './core/cron';
import { closeDb } from './db/client';
import { createLogger } from './utils/logger';

const log = createLogger('main');

async function main() {
  log.info('Starting TetherPulse...');

  const env = getEnv();
  log.info({ nodeEnv: env.NODE_ENV }, 'Environment validated');

  // Initialize WDK
  await wdkManager.initialize();

  // Start Telegram bot
  const telegram = new TelegramBot();
  await telegram.start();

  // Start API server (dashboard)
  await startApiServer();

  // Start cron jobs (daily digest)
  startCronJobs();

  log.info({
    chains: wdkManager.getEnabledChains(),
  }, 'TetherPulse is running!');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Shutting down...');
    await telegram.stop();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  log.fatal({ error }, 'Fatal error during startup');
  process.exit(1);
});
