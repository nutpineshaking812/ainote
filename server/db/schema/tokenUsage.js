import { pgTable, varchar, integer, timestamp, index, bigint } from 'drizzle-orm/pg-core';
import { mySchema, timestampCoerced } from './_base.js';
import { sql } from 'drizzle-orm';

export const tokenUsage = mySchema.table(
  'token_usage',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    organizationId: varchar('organization_id', { length: 255 }),
    appId: varchar('app_id', { length: 255 }),
    model: varchar('model', { length: 255 }).notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    runName: varchar('run_name', { length: 255 }),
    taskId: varchar('task_id', { length: 255 }),
    timestamp: timestampCoerced('timestamp').notNull().default(sql`now()`),
  },
  (table) => ({
    userIdIdx: index('token_usage_user_idx').on(table.userId),
    orgIdIdx: index('token_usage_org_idx').on(table.organizationId),
    appIdIdx: index('token_usage_app_idx').on(table.appId),
    runNameIdx: index('token_usage_run_idx').on(table.runName),
    taskIdIdx: index('token_usage_task_idx').on(table.taskId),
    timestampIdx: index('token_usage_time_idx').on(table.timestamp),
  })
);
