import { pgTable, varchar, jsonb, timestamp, index, integer } from 'drizzle-orm/pg-core';
import { mySchema, timestampCoerced } from './_base.js';
import { sql } from 'drizzle-orm';

export const orgWidgets = mySchema.table(
  'org_widgets',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    icon: varchar('icon', { length: 255 }).notNull().default('SettingOutlined'),
    type: varchar('type', { length: 50 }).notNull().default('form'),
    config: jsonb('config').notNull().default({}),
    visibleToRoles: jsonb('visible_to_roles').notNull().default([]),
    visibleToDepartments: jsonb('visible_to_departments').notNull().default([]),
    status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
    priority: integer('priority').notNull().default(0),
    createdAt: timestampCoerced('created_at').notNull().default(sql`now()`),
    updatedAt: timestampCoerced('updated_at').notNull().default(sql`now()`),
  },
  (table) => ({
    orgIdIdx: index('widget_org_idx').on(table.orgId),
  })
);
