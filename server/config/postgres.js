import pg from 'pg';
import env from './env.js';
import { logger } from './logger.js';

const { Pool } = pg;

// Use VECTOR_POSTGRES_URL since it's already in .env
const connectionString = process.env.VECTOR_POSTGRES_URL;

if (!connectionString) {
  logger.warn('[PostgresConfig] VECTOR_POSTGRES_URL not found, PostgreSQL features may not work.');
}

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  logger.error('[PostgresConfig] Unexpected error on idle client', err);
});

/**
 * Executes a query using the shared pool
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Gets a client from the pool for transactions
 */
export const getClient = () => pool.connect();

export default pool;
