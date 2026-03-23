import cron from 'node-cron';
import { digestService } from './digest-service';
import { autoTipService } from './autotip-service';
import { engine } from './engine';
import { createLogger } from '../utils/logger';

const log = createLogger('cron');

// Track active chats for digest generation
const activeChats = new Map<string, { platform: string; name: string }>();

export function registerActiveChat(chatId: string, platform: string, name: string) {
  activeChats.set(`${platform}:${chatId}`, { platform, name });
}

export function startCronJobs() {
  // Daily digest at 00:00 UTC
  cron.schedule('0 0 * * *', async () => {
    log.info({ chatCount: activeChats.size }, 'Running daily digest cron');

    for (const [key, chat] of activeChats) {
      const chatId = key.split(':').slice(1).join(':');
      try {
        const digest = await digestService.generateDailyDigest(chatId, chat.platform, chat.name);
        const adapter = engine.getAdapter(chat.platform);
        if (adapter) {
          await adapter.sendMessage(chatId, `📊 *Daily Digest*\n\n${digest}`);
        }
        log.info({ chatId, platform: chat.platform }, 'Digest posted');
      } catch (error) {
        log.error({ error, chatId }, 'Failed to generate digest');
      }
    }
  });

  // Reset auto-tip daily counters at midnight
  cron.schedule('0 0 * * *', async () => {
    await autoTipService.resetDailyCounters();
  });

  log.info('Cron jobs started');
}
