import { Telegraf } from 'telegraf';
import { getEnv } from '../../config/env';
import { engine } from '../../core/engine';
import type { PlatformAdapter, InlineButton } from '../types';
import { toTelegramButtons, helpText } from './formatters';
import {
  handleStart,
  handleTipCommand,
  handleBalance,
  handleLeaderboard,
  handleReputation,
  handleAutoTip,
  handlePulse,
  handleFaucet,
  handleYield,
  handlePool,
  handleMessageReaction,
  handleTextMessage,
  handleCallbackQuery,
} from './handlers';
import { createLogger } from '../../utils/logger';

const log = createLogger('telegram-bot');

export class TelegramBot implements PlatformAdapter {
  platform = 'telegram' as const;
  private bot: Telegraf;

  constructor() {
    this.bot = new Telegraf(getEnv().TELEGRAM_BOT_TOKEN);
  }

  async start(): Promise<void> {
    // Register commands
    this.bot.command('start', handleStart);
    this.bot.command('tip', handleTipCommand);
    this.bot.command('balance', handleBalance);
    this.bot.command('leaderboard', handleLeaderboard);
    this.bot.command('reputation', handleReputation);
    this.bot.command('autotip', handleAutoTip);
    this.bot.command('pulse', handlePulse);
    this.bot.command('faucet', handleFaucet);
    this.bot.command('yield', handleYield);
    this.bot.command('pool', handlePool);
    this.bot.command('help', async (ctx) => {
      await ctx.reply(helpText(), { parse_mode: 'Markdown' });
    });

    // Handle text messages (for NLP tip detection + contribution scoring)
    this.bot.on('text', handleTextMessage);

    // Handle emoji reactions (💰 = tip)
    this.bot.on('message_reaction' as any, handleMessageReaction);

    // Handle inline button callbacks (for tip suggestions)
    this.bot.on('callback_query', handleCallbackQuery);

    // Error handler
    this.bot.catch((err: any) => {
      log.error({ error: err }, 'Telegraf error');
    });

    // Register with engine
    engine.registerAdapter(this);

    // Launch (don't await — long-polling runs in background)
    this.bot.launch().then(() => {
      log.info('Telegram bot polling started');
    });
    log.info('Telegram bot started');
  }

  async stop(): Promise<void> {
    this.bot.stop('SIGTERM');
    log.info('Telegram bot stopped');
  }

  async sendMessage(chatId: string, text: string, buttons?: InlineButton[]): Promise<void> {
    const opts: any = { parse_mode: 'Markdown' as const };
    if (buttons && buttons.length > 0) {
      Object.assign(opts, toTelegramButtons(buttons));
    }
    await this.bot.telegram.sendMessage(chatId, text, opts);
  }
}
