import { varchar, text, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { mySchema, timestampCoerced } from './_base.js';
import crypto from 'crypto';

export const formRecords = mySchema.table(
  'form_records',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    formId: varchar('form_id', { length: 255 }).notNull(),
    appId: varchar('app_id', { length: 255 }).notNull(),
    docId: varchar('doc_id', { length: 255 }),
    data: jsonb('data').default({}).notNull(),
    createdBy: varchar('created_by', { length: 255 }),
    submitSource: varchar('submit_source', { length: 255 }).default('WEB_FORM'),
    sourceTokenName: varchar('source_token_name', { length: 255 }),
    createdAt: timestampCoerced('created_at').default(sql`now()`).notNull(),
    updatedAt: timestampCoerced('updated_at').default(sql`now()`).notNull(),
  },
  (table) => ({
    formIdx: index('form_records_form_idx').on(table.formId),
    appIdx: index('form_records_app_idx').on(table.appId),
    createdByIdx: index('form_records_created_by_idx').on(table.createdBy),
  })
);
