import { varchar, text, integer, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { mySchema, timestampCoerced } from './_base.js';
import crypto from 'crypto';

export const departments = mySchema.table(
  'departments',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    organizationId: varchar('organization_id', { length: 255 }).notNull(),
    parentId: varchar('parent_id', { length: 255 }),
    managerId: varchar('manager_id', { length: 255 }),
    order: integer('order').default(0).notNull(),
    description: text('description').default(''),
    
    createdAt: timestampCoerced('created_at').default(sql`now()`).notNull(),
    updatedAt: timestampCoerced('updated_at').default(sql`now()`).notNull(),
  },
  (table) => ({
    orgIdx: index('dept_org_idx').on(table.organizationId),
    parentIdx: index('dept_parent_idx').on(table.parentId),
    orgOrderIdx: index('dept_org_order_idx').on(table.organizationId, table.order),
  })
);
