import { pgTable, varchar, jsonb, timestamp, boolean, index, text } from 'drizzle-orm/pg-core';
import { mySchema, timestampCoerced } from './_base.js';
import { sql } from 'drizzle-orm';

export const applications = mySchema.table(
  'applications',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 100 }).default('FolderOutlined'),
    iconColor: varchar('icon_color', { length: 50 }).default('#1890ff'),
    owner: varchar('owner', { length: 255 }).notNull(),
    organizationId: varchar('organization_id', { length: 255 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestampCoerced('created_at').notNull().default(sql`now()`),
    updatedAt: timestampCoerced('updated_at').notNull().default(sql`now()`),
  },
  (table) => ({
    ownerIdx: index('app_owner_idx').on(table.owner),
    orgIdx: index('app_org_idx').on(table.organizationId),
  })
);
