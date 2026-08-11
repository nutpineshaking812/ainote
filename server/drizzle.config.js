import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Drizzle Configuration
 * Using schemaFilter: ['lc'] to isolate Drizzle's management to only our custom schema.
 * This prevents accidental deletion of tables stored in 'public' (like mem0, etc).
 */
export default defineConfig({
  schema: './db/schema/index.js',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.VECTOR_POSTGRES_URL,
  },
  // We only care about our 'lc' schema for versioning and push actions.
  schemaFilter: ["lc"],
});
