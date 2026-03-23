import { pgSchema, serial, text, timestamp, numeric, integer, boolean, index, unique } from 'drizzle-orm/pg-core';

const tipbotSchema = pgSchema('tipbot');
const pgTable = tipbotSchema.table.bind(tipbotSchema);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  platform: text('platform').notNull(), // 'telegram' | 'discord'
  platformId: text('platform_id').notNull(),
  username: text('username').notNull(),
  encryptedSeed: text('encrypted_seed').notNull(),
  seedIv: text('seed_iv').notNull(),
  seedAuthTag: text('seed_auth_tag').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isBanned: boolean('is_banned').default(false).notNull(),
}, (table) => [
  unique('uniq_platform_user').on(table.platform, table.platformId),
  index('idx_users_platform').on(table.platform, table.platformId),
]);

export const walletAddresses = pgTable('wallet_addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  chain: text('chain').notNull(), // 'ton' | 'tron' | 'polygon' | 'arbitrum'
  address: text('address').notNull(),
  isDeployed: boolean('is_deployed').default(false).notNull(),
}, (table) => [
  unique('uniq_user_chain').on(table.userId, table.chain),
]);

export const tips = pgTable('tips', {
  id: serial('id').primaryKey(),
  senderId: integer('sender_id').references(() => users.id).notNull(),
  receiverId: integer('receiver_id').references(() => users.id).notNull(),
  amount: numeric('amount', { precision: 20, scale: 6 }).notNull(),
  asset: text('asset').notNull(), // 'USDT' | 'XAUT'
  chain: text('chain').notNull(),
  txHash: text('tx_hash'),
  gasCostUsd: numeric('gas_cost_usd', { precision: 10, scale: 6 }),
  status: text('status').default('pending').notNull(), // 'pending' | 'confirmed' | 'failed'
  aiSuggested: boolean('ai_suggested').default(false).notNull(),
  messageContext: text('message_context'),
  chatId: text('chat_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_tips_sender').on(table.senderId),
  index('idx_tips_receiver').on(table.receiverId),
  index('idx_tips_chat').on(table.chatId),
  index('idx_tips_created').on(table.createdAt),
]);

export const contributionScores = pgTable('contribution_scores', {
  id: serial('id').primaryKey(),
  chatId: text('chat_id').notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  messageText: text('message_text').notNull(),
  score: integer('score').notNull(),
  category: text('category'), // 'technical_help' | 'community' | 'resource_sharing' etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_scores_chat').on(table.chatId),
  index('idx_scores_user').on(table.userId),
]);

export const rateLimits = pgTable('rate_limits', {
  userId: integer('user_id').references(() => users.id).primaryKey(),
  windowStart: timestamp('window_start').defaultNow().notNull(),
  tipCount: integer('tip_count').default(0).notNull(),
  totalAmount: numeric('total_amount', { precision: 20, scale: 6 }).default('0').notNull(),
  dailyStart: timestamp('daily_start').defaultNow().notNull(),
  dailyAmount: numeric('daily_amount', { precision: 20, scale: 6 }).default('0').notNull(),
});

export const autoTipRules = pgTable('auto_tip_rules', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  chatId: text('chat_id').notNull(),
  amount: numeric('amount', { precision: 20, scale: 6 }).notNull(),
  asset: text('asset').default('USDT').notNull(),
  minScore: integer('min_score').default(70).notNull(), // Min contribution score to trigger
  category: text('category'), // null = any category
  maxPerDay: integer('max_per_day').default(5).notNull(),
  tipsToday: integer('tips_today').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_autorules_chat').on(table.chatId),
  index('idx_autorules_user').on(table.userId),
]);

// Yield deposits — tracks Aave V3 deposits per user
export const yieldDeposits = pgTable('yield_deposits', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  chain: text('chain').notNull(),
  amount: numeric('amount', { precision: 20, scale: 6 }).notNull(),
  aTokenBalance: numeric('a_token_balance', { precision: 20, scale: 6 }).default('0').notNull(),
  txHash: text('tx_hash'),
  status: text('status').default('deposited').notNull(), // 'deposited' | 'withdrawn'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  withdrawnAt: timestamp('withdrawn_at'),
}, (table) => [
  index('idx_yield_user').on(table.userId),
]);

// Tip pools / bounties
export const tipPools = pgTable('tip_pools', {
  id: serial('id').primaryKey(),
  creatorId: integer('creator_id').references(() => users.id).notNull(),
  chatId: text('chat_id').notNull(),
  title: text('title').notNull(),
  targetAmount: numeric('target_amount', { precision: 20, scale: 6 }).notNull(),
  currentAmount: numeric('current_amount', { precision: 20, scale: 6 }).default('0').notNull(),
  asset: text('asset').default('USDT').notNull(),
  status: text('status').default('open').notNull(), // 'open' | 'funded' | 'claimed' | 'expired'
  claimedBy: integer('claimed_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
}, (table) => [
  index('idx_pools_chat').on(table.chatId),
  index('idx_pools_status').on(table.status),
]);

// Pool contributions
export const poolContributions = pgTable('pool_contributions', {
  id: serial('id').primaryKey(),
  poolId: integer('pool_id').references(() => tipPools.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  amount: numeric('amount', { precision: 20, scale: 6 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_pool_contribs').on(table.poolId),
]);

// Tip streaks — tracks daily tipping habits
export const tipStreaks = pgTable('tip_streaks', {
  userId: integer('user_id').references(() => users.id).primaryKey(),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  totalTipDays: integer('total_tip_days').default(0).notNull(),
  lastTipDate: timestamp('last_tip_date'),
  badges: text('badges').default('').notNull(), // comma-separated badge codes
});

export const dailyDigests = pgTable('daily_digests', {
  id: serial('id').primaryKey(),
  chatId: text('chat_id').notNull(),
  platform: text('platform').notNull(),
  content: text('content').notNull(),
  tipCount: integer('tip_count').default(0).notNull(),
  totalVolume: numeric('total_volume', { precision: 20, scale: 6 }).default('0').notNull(),
  date: timestamp('date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_digests_chat_date').on(table.chatId, table.date),
]);
