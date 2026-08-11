import { varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { mySchema, timestampCoerced } from './_base.js';

/**
 * Chat Conversations Table
 * Stores metadata for chat sessions.
 */
export const chatConversations = mySchema.table('chat_conversations', {
  id: varchar('id', { length: 255 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id', { length: 255 }),
  appId: varchar('app_id', { length: 255 }),
  title: varchar('title', { length: 500 }),
  targetId: varchar('target_id', { length: 255 }),
  employeeId: varchar('employee_id', { length: 255 }),
  scenario: varchar('scenario', { length: 255 }).default('GENERAL').notNull(),
  createdAt: timestampCoerced('created_at').default(sql`now()`),
  updatedAt: timestampCoerced('updated_at')
    .default(sql`now()`)
    .$onUpdate(() => new Date()),
});

