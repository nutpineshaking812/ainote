import { varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { mySchema } from './_base.js';

export const gatewaySessions = mySchema.table('gateway_sessions', {
  id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').notNull().unique(), 
  platform: text('platform').notNull(), 
  channelId: varchar('channel_id', { length: 255 }), 
  platformMetadata: jsonb('platform_metadata').notNull().default({}), 
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
