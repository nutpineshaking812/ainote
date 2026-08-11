import { pgTable, varchar, boolean, jsonb, timestamp, index, uniqueIndex, text } from 'drizzle-orm/pg-core';
import { mySchema, timestampCoerced } from './_base.js';
import { sql } from 'drizzle-orm';

export const packageSkills = mySchema.table(
  'package_skills',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    folderName: varchar('folder_name', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    organizationId: varchar('organization_id', { length: 255 }),
    ownerId: varchar('owner_id', { length: 255 }),
    parameters: jsonb('parameters').notNull().default({}),
    requires: jsonb('requires').notNull().default({}),
    hideResult: boolean('hide_result').notNull().default(false),
    status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
    hasResources: boolean('has_resources').notNull().default(false),
    lastSyncedAt: timestampCoerced('last_synced_at').notNull().default(sql`now()`),
    createdAt: timestampCoerced('created_at').notNull().default(sql`now()`),
    updatedAt: timestampCoerced('updated_at').notNull().default(sql`now()`),
  },
  (table) => ({
    folderNameIdx: index('skill_folder_idx').on(table.folderName),
    nameIdx: index('skill_name_idx').on(table.name),
    orgIdIdx: index('skill_org_idx').on(table.organizationId),
    ownerIdIdx: index('skill_owner_idx').on(table.ownerId),
    uniqueOrgName: uniqueIndex('skill_org_name_unique_idx').on(table.organizationId, table.name),
  })
);
