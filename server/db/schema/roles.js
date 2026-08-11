import { varchar, text, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { mySchema, timestampCoerced } from './_base.js';
import crypto from 'crypto';

export const roles = mySchema.table(
  'roles',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    nameEn: varchar('name_en', { length: 255 }),
    organizationId: varchar('organization_id', { length: 255 }).notNull(),
    scope: varchar('scope', { length: 50 }).default('GLOBAL').notNull(), // GLOBAL, APP, TEMPLATE
    appId: varchar('app_id', { length: 255 }),
    isSystem: boolean('is_system').default(false).notNull(),
    permissions: jsonb('permissions').default([]).notNull(),
    key: varchar('key', { length: 255 }), // SYSTEM_OWNER, etc.
    description: text('description').default(''),
    descriptionEn: text('description_en').default(''),
    
    createdAt: timestampCoerced('created_at').default(sql`now()`).notNull(),
    updatedAt: timestampCoerced('updated_at').default(sql`now()`).notNull(),
  },
  (table) => ({
    orgScopeIdx: index('role_org_scope_idx').on(table.organizationId, table.scope),
    appIdx: index('role_app_idx').on(table.appId),
    orgNameUnique: uniqueIndex('role_org_name_unique_idx').on(table.organizationId, table.name, table.scope, table.appId),
    orgKeyUnique: uniqueIndex('role_org_key_unique_idx').on(table.organizationId, table.key, table.scope, table.appId),
  })
);
