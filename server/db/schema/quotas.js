import { pgTable, varchar, integer, timestamp, uniqueIndex, bigint } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { mySchema } from './_base.js';
import { timestampCoerced } from './_base.js';

export const quotas = mySchema.table(
  'quotas',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    targetType: varchar('target_type', { length: 50 }).notNull(), // USER, ORG
    targetId: varchar('target_id', { length: 255 }).notNull(),
    tokenBalance: bigint('token_balance', { mode: 'number' }).notNull().default(0),
    totalTokenUsage: bigint('total_token_usage', { mode: 'number' }).notNull().default(0),
    usageLimit: integer('usage_limit').notNull().default(-1),
    invitationSlots: integer('invitation_slots').notNull().default(0),
    memberLimit: integer('member_limit').notNull().default(50),
    lastResetDate: timestampCoerced('last_reset_date'),
    createdAt: timestampCoerced('created_at').default(sql`now()`).notNull(),
    updatedAt: timestampCoerced('updated_at').default(sql`now()`).notNull(),
  },
  (table) => {
    return {
      targetIdx: uniqueIndex('quotas_target_idx').on(table.targetType, table.targetId),
    };
  }
);
