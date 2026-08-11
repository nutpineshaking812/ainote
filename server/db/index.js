import { drizzle } from 'drizzle-orm/node-postgres';
import { execSync } from 'child_process';
import pool from '../config/postgres.js';
import * as schema from './schema/index.js';
import { logger } from '../config/logger.js';

/**
 * Initialize Drizzle client with existing node-postgres pool.
 */
export const db = drizzle(pool, { schema });

/**
 * Push schema at startup to create/update all tables.
 * drizzle-kit push syncs the database directly from the Drizzle schema,
 * no incremental migrations needed.
 */
export const migrateDB = async () => {
  try {
    logger.info('[DB] Pushing schema to create/update tables...');
    execSync('npx drizzle-kit push', {
      cwd: process.cwd(),
      stdio: 'inherit',
      timeout: 60000,
    });
    logger.info('[DB] Schema push completed');
  } catch (err) {
    logger.error({ err }, '[DB] Schema push failed');
    throw err;
  }
};

export default db;
