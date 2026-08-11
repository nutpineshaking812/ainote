import { pgTable, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { mySchema, timestampCoerced } from './_base.js';
import { sql } from 'drizzle-orm';

export const apiKeys = mySchema.table(
  'api_keys',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    appId: varchar('app_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    prefix: varchar('prefix', { length: 50 }).notNull(),
    hash: varchar('hash', { length: 255 }).notNull(),
    lastUsedAt: timestampCoerced('last_used_at'),
    createdAt: timestampCoerced('created_at').notNull().default(sql`now()`),
    updatedAt: timestampCoerced('updated_at').notNull().default(sql`now()`),
  },
  (table) => ({
    appIdx: index('api_key_app_idx').on(table.appId),
    prefixIdx: index('api_key_prefix_idx').on(table.prefix),
  })
);
