import { pgTable, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { mySchema, timestampCoerced } from './_base.js';
import { sql } from 'drizzle-orm';

export const permissionAssignments = mySchema.table(
  'permission_assignments',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 255 }).notNull(),
    principalType: varchar('principal_type', { length: 50 }).notNull(), // USER, DEPARTMENT, ROLE, ALL
    principalId: varchar('principal_id', { length: 255 }).notNull(),
    roleId: varchar('role_id', { length: 255 }).notNull(),
    roleKey: varchar('role_key', { length: 255 }), // Cache for fast lookup
    scope: varchar('scope', { length: 50 }).notNull(), // GLOBAL, APP, RESOURCE
    resourceId: varchar('resource_id', { length: 255 }).notNull(),
    createdBy: varchar('created_by', { length: 255 }),
    createdAt: timestampCoerced('created_at').notNull().default(sql`now()`),
    updatedAt: timestampCoerced('updated_at').notNull().default(sql`now()`),
  },
  (table) => ({
    resourceScopeIdx: index('perm_res_scope_idx').on(table.resourceId, table.scope),
    resourceScopeTypeIdx: index('perm_res_scope_type_idx').on(table.resourceId, table.scope, table.principalType),
    orgPrincipalIdx: index('perm_org_principal_idx').on(table.organizationId, table.principalId),
    principalScopeIdx: index('perm_principal_scope_idx').on(table.principalId, table.scope),
    uniqueAssignmentIdx: uniqueIndex('perm_unique_idx').on(table.principalId, table.roleId, table.scope, table.resourceId),
    orgPrincipalTypeIdx: index('perm_org_principal_type_idx').on(table.organizationId, table.principalId, table.principalType),
  })
);
