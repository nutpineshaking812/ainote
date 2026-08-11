import { pgTable, varchar, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { mySchema, timestampCoerced } from './_base.js';
import crypto from 'crypto';

export const organizationMembers = mySchema.table(
  'organization_members',
  {
    id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: varchar('user_id', { length: 255 }).notNull(),
    organizationId: varchar('organization_id', { length: 255 }).notNull(),
    
    // Arrays stored as JSONB for now to maintain MongoDB compatibility
    roleIds: jsonb('role_ids').default([]).notNull(),
    departmentIds: jsonb('department_ids').default([]).notNull(),
    
    status: varchar('status', { length: 50 }).default('ACTIVE').notNull(),
    
    // Cache for permissions to avoid frequent complex joins/recalculations
    permCache: jsonb('perm_cache'),
    permCacheUpdatedAt: timestampCoerced('perm_cache_updated_at'),
    
    joinedAt: timestampCoerced('joined_at').default(sql`now()`).notNull(),
    createdAt: timestampCoerced('created_at').default(sql`now()`).notNull(),
    updatedAt: timestampCoerced('updated_at').default(sql`now()`).notNull(),
  },
  (table) => ({
    userOrgIdx: uniqueIndex('org_member_user_org_idx').on(table.userId, table.organizationId),
  })
);
