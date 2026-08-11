import { pgTable, varchar, boolean, timestamp, index, uniqueIndex, text } from 'drizzle-orm/pg-core';
import { mySchema, timestampCoerced } from './_base.js';
import { sql } from 'drizzle-orm';

export const orgCategories = mySchema.table(
  'org_categories',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 }).notNull(),
    key: varchar('key', { length: 255 }).notNull(),
    label: varchar('label', { length: 255 }).notNull(),
    icon: varchar('icon', { length: 255 }).notNull().default('FolderOutlined'),
    color: varchar('color', { length: 50 }).notNull().default('#1890ff'),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    scope: varchar('scope', { length: 50 }).notNull().default('organization'),
    createdBy: varchar('created_by', { length: 255 }),
    createdAt: timestampCoerced('created_at').notNull().default(sql`now()`),
    updatedAt: timestampCoerced('updated_at').notNull().default(sql`now()`),
  },
  (table) => ({
    orgIdIdx: index('cat_org_idx').on(table.organizationId),
    scopeIdx: index('cat_scope_idx').on(table.scope),
    uniqueOrgKey: uniqueIndex('cat_org_key_unique_idx').on(table.organizationId, table.key),
  })
);
