import { varchar, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { mySchema, timestampCoerced } from './_base.js';

export const agentTeams = mySchema.table(
  'agent_teams',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    appRef: varchar('app_ref', { length: 255 }).notNull(), // 归属应用
    name: varchar('name', { length: 255 }).notNull(), // 项目组名称
    ceoEmployeeId: varchar('ceo_employee_id', { length: 255 }).notNull(), // CEO ID
    memberEmployeeIds: jsonb('member_employee_ids').default([]).notNull(), // 招募的核心员工 UUID 数组
    conversationId: varchar('conversation_id', { length: 255 }), // 绑定的会话 ID
    status: varchar('status', { length: 100 }).default('IDLE').notNull(), // IDLE, RUNNING, COMPLETED
    createdAt: timestampCoerced('created_at').default(sql`now()`).notNull(),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    updatedAt: timestampCoerced('updated_at').default(sql`now()`).notNull(),
  },
  (table) => ({
    appRefIdx: index('at_app_ref_idx').on(table.appRef),
    ceoIdx: index('at_ceo_idx').on(table.ceoEmployeeId),
  })
);
