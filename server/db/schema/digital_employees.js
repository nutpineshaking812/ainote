import { varchar, text, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { mySchema, timestampCoerced } from './_base.js';

/**
 * 数字员工 (Digital Employees)
 * 将 Workflow 包装成具备人格、职责、头像和固定知识背景的业务实体。
 */
export const digitalEmployees = mySchema.table(
  'digital_employees',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    appRef: varchar('app_ref', { length: 255 }).notNull(), // 归属应用

    // 形象与职能
    name: varchar('name', { length: 100 }).notNull(), // “老张”
    roleTitle: varchar('role_title', { length: 200 }), // “财务审计主任”
    avatar: text('avatar'), // 头像 URL
    description: text('description'), // 人格性格定义及职责描述
    scenario: varchar('scenario', { length: 50 }).default('GENERAL').notNull(),

    // 核心逻辑绑定
    workflowId: varchar('workflow_id', { length: 255 }).notNull(), // 执行逻辑 (大脑)

    // 业务状态
    isActive: boolean('is_active').default(true),

    metadata: jsonb('metadata').default({
      model: 'gpt-4o',
      temperature: 0.7,
    }),

    createdAt: timestampCoerced('created_at')
      .default(sql`now()`)
      .notNull(),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    updatedAt: timestampCoerced('updated_at')
      .default(sql`now()`)
      .notNull(),
    updatedBy: varchar('updated_by', { length: 255 }),
  },
  (table) => {
    return {
      appRefIdx: index('de_app_ref_idx').on(table.appRef),
      workflowIdx: index('de_workflow_idx').on(table.workflowId),
    };
  },
);

/**
 * 数字员工与会话的活跃关系 (Sessions)
 */
export const employeeSessionHistory = mySchema.table(
  'employee_session_history',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    employeeId: varchar('employee_id', { length: 255 }).notNull(),
    sessionId: varchar('session_id', { length: 255 }).notNull(),
    joinedAt: timestampCoerced('joined_at')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => {
    return {
      employeeIdx: index('esh_employee_idx').on(table.employeeId),
      sessionIdx: index('esh_session_idx').on(table.sessionId),
    };
  },
);
