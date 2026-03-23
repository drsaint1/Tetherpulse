import { createLogger } from './logger';

const log = createLogger('retry');

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  opts: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000 } = opts;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        log.error({ error, label, attempt }, 'All retries exhausted');
        throw error;
      }
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      log.warn({ label, attempt, nextRetryMs: jitter }, 'Retrying after error');
      await new Promise(resolve => setTimeout(resolve, jitter));
    }
  }
  throw new Error('Unreachable');
}
