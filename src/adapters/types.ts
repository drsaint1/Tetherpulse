export type Platform = 'telegram';

export interface ChatMessage {
  platform: Platform;
  chatId: string;
  messageId: string;
  userId: string;
  username: string;
  text: string;
  replyToUserId?: string;
  replyToUsername?: string;
  timestamp: Date;
}

export interface BotReply {
  text: string;
  parseMode?: 'Markdown' | 'HTML';
}

export interface InlineButton {
  label: string;
  callbackData: string;
}

export interface TipSuggestion {
  recipientUsername: string;
  recipientUserId: string;
  amount: number;
  asset: 'USDT' | 'XAUT';
  reason: string;
  score: number;
}

export interface PlatformAdapter {
  platform: Platform;
  sendMessage(chatId: string, text: string, buttons?: InlineButton[]): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
