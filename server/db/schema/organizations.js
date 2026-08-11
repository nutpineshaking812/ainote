import { varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { mySchema, timestampCoerced } from './_base.js';
import crypto from 'crypto';

export const organizations = mySchema.table(
  'organizations',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
    logo: text('logo').default(''),
    description: text('description').default(''),
    slogan: text('slogan').default(''),
    type: varchar('type', { length: 50 }).default('TEAM').notNull(), // PERSONAL, TEAM
    status: varchar('status', { length: 50 }).default('ACTIVE').notNull(), // ACTIVE, SUSPENDED, DELETED
    
    createdAt: timestampCoerced('created_at').default(sql`now()`).notNull(),
    updatedAt: timestampCoerced('updated_at').default(sql`now()`).notNull(),
  },
  (table) => ({
    ownerIdx: index('org_owner_idx').on(table.ownerId),
    statusIdx: index('org_status_idx').on(table.status),
    typeIdx: index('org_type_idx').on(table.type),
  })
);
