import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { getEnv } from '../config/env';
import { createLogger } from '../utils/logger';

const log = createLogger('db');

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _pool: Pool | null = null;

export function getDb() {
  if (!_db) {
    const env = getEnv();
    _pool = new Pool({ connectionString: env.DATABASE_URL });
    _db = drizzle(_pool, { schema });
    log.info('Database connection pool created');
  }
  return _db;
}

export async function closeDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
    log.info('Database connection pool closed');
  }
}

export { schema };
