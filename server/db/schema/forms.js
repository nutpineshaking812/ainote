import { varchar, text, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { mySchema, timestampCoerced } from './_base.js';
import crypto from 'crypto';

export const forms = mySchema.table(
  'forms',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    appId: varchar('app_id', { length: 255 }).notNull(),
    owner: varchar('owner', { length: 255 }).notNull(),
    fields: jsonb('fields').default([]).notNull(),
    actions: jsonb('actions').default([]).notNull(),
    showIndex: boolean('show_index').default(false).notNull(),
    createdAt: timestampCoerced('created_at').default(sql`now()`).notNull(),
    updatedAt: timestampCoerced('updated_at').default(sql`now()`).notNull(),
  },
  (table) => ({
    appIdx: index('forms_app_idx').on(table.appId),
    ownerIdx: index('forms_owner_idx').on(table.owner),
  })
);
