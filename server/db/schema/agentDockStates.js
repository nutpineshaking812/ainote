import { varchar, text, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { mySchema, timestampCoerced } from './_base.js';

/**
 * Agent Dock State（数字员工 Dock 坞状态）
 * 记录每个用户在特定业务对象（文档、表单等）上召唤的数字员工配置
 *
 * 复合唯一键：(userId, targetId, scenario)
 * - userId:   当前登录用户 ID（物理隔离多人协作）
 * - targetId: 业务对象 ID（文档 ID / 表单 ID 等）
 * - scenario: 使用场景标识（如 document_assistant / form_editor）
 */
export const agentDockStates = mySchema.table(
  'agent_dock_states',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    userId: varchar('user_id', { length: 255 }).notNull(),
    targetId: varchar('target_id', { length: 255 }).notNull(),
    scenario: varchar('scenario', { length: 100 }).notNull().default('GENERAL'),

    // 已停靠员工 ID 列表（有序）
    dockEmployeeIds: jsonb('dock_employee_ids').default([]),
    // 当前激活聚焦的员工 ID
    activeEmployeeId: varchar('active_employee_id', { length: 255 }),

    updatedAt: timestampCoerced('updated_at')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // 确保每个用户在每个目标对象的每个场景下只有一条记录
    uniqueUserTarget: uniqueIndex('ads_unique_user_target_idx').on(
      table.userId,
      table.targetId,
      table.scenario,
    ),
    userIdx: index('ads_user_idx').on(table.userId),
    targetIdx: index('ads_target_idx').on(table.targetId),
  }),
);
