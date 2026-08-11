import { pgTable, varchar, jsonb, timestamp, index, uniqueIndex, text, integer } from 'drizzle-orm/pg-core';
import { mySchema, timestampCoerced } from './_base.js';
import { sql } from 'drizzle-orm';

export const aiMemories = mySchema.table(
  'ai_memories',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    appId: varchar('app_id', { length: 255 }),
    userId: varchar('user_id', { length: 255 }),
    sessionId: varchar('session_id', { length: 255 }),
    sessionName: varchar('session_name', { length: 255 }),
    title: varchar('title', { length: 255 }).notNull(),
    blocks: jsonb('blocks').notNull().default([]),
    content: text('content'),
    category: varchar('category', { length: 50 }).notNull().default('FACT'),
    entities: jsonb('entities').notNull().default([]),
    importance: integer('importance').notNull().default(5),
    recallCount: integer('recall_count').notNull().default(0),
    lastRecalledAt: timestampCoerced('last_recalled_at'),
    sourceExecutionId: varchar('source_execution_id', { length: 255 }),
    version: integer('version').notNull().default(1),
    createdAt: timestampCoerced('created_at').notNull().default(sql`now()`),
    updatedAt: timestampCoerced('updated_at').notNull().default(sql`now()`),
  },
  (table) => ({
    appIdIdx: index('memory_app_idx').on(table.appId),
    userIdIdx: index('memory_user_idx').on(table.userId),
    sessionIdIdx: index('memory_session_idx').on(table.sessionId),
    categoryIdx: index('memory_category_idx').on(table.category),
    appSessionCatIdx: index('memory_app_session_cat_idx').on(table.appId, table.sessionId, table.category),
    uniqueAppTitleSession: uniqueIndex('memory_app_title_session_unique_idx').on(table.appId, table.title, table.sessionId),
  })
);
