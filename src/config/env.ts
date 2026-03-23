import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),

  // Telegram (required)
  TELEGRAM_BOT_TOKEN: z.string().min(1),

  // Google Gemini
  GEMINI_API_KEY: z.string().min(1),

  // WDK
  WDK_SEED_ENCRYPTION_KEY: z.string().min(32).describe('32-byte hex key for AES-256-GCM seed encryption'),

  // EVM Chain RPCs — defaults point to testnets
  POLYGON_RPC_URL: z.string().default('https://rpc-amoy.polygon.technology'),
  ARBITRUM_RPC_URL: z.string().default('https://sepolia-rollup.arbitrum.io/rpc'),

  // TON Gasless (optional — leave empty to skip TON chain)
  TON_CENTER_URL: z.string().default('https://testnet.toncenter.com/api/v3'),
  TON_CENTER_API_KEY: z.string().default(''),
  TON_API_URL: z.string().default('https://testnet.tonapi.io/v2'),
  TON_API_KEY: z.string().default(''),
  TON_PAYMASTER_ADDRESS: z.string().default(''),

  // TRON Gas-Free (optional — leave empty to skip TRON chain)
  TRON_PROVIDER_URL: z.string().default('https://api.shasta.trongrid.io'),
  TRON_GASFREE_PROVIDER_URL: z.string().default(''),
  TRON_GASFREE_API_KEY: z.string().default(''),
  TRON_GASFREE_API_SECRET: z.string().default(''),
  TRON_SERVICE_PROVIDER: z.string().default(''),
  TRON_VERIFYING_CONTRACT: z.string().default(''),

  // Optional
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Rate limits
  MAX_TIPS_PER_HOUR: z.coerce.number().default(20),
  MAX_DAILY_AMOUNT_USD: z.coerce.number().default(500),
  MIN_TIP_USDT: z.coerce.number().default(0.10),
  MIN_TIP_XAUT: z.coerce.number().default(0.0001),
  NEW_ACCOUNT_MAX_USD: z.coerce.number().default(10),
  NEW_ACCOUNT_HOURS: z.coerce.number().default(24),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Invalid environment variables:');
      console.error(result.error.format());
      process.exit(1);
    }
    _env = result.data;
  }
  return _env;
}
