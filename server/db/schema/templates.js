import { pgTable, varchar, jsonb, timestamp, index, text } from 'drizzle-orm/pg-core';
import { mySchema, timestampCoerced } from './_base.js';
import { sql } from 'drizzle-orm';

export const templates = mySchema.table(
  'templates',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    blocks: jsonb('blocks').notNull().default([]),
    contentPlain: text('content_plain').notNull().default(''),
    tags: jsonb('tags').notNull().default([]),
    type: varchar('type', { length: 50 }).notNull().default('document'),
    scope: varchar('scope', { length: 50 }).notNull().default('personal'),
    appId: varchar('app_id', { length: 255 }),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    updatedBy: varchar('updated_by', { length: 255 }).notNull(),
    createdAt: timestampCoerced('created_at').notNull().default(sql`now()`),
    updatedAt: timestampCoerced('updated_at').notNull().default(sql`now()`),
  },
  (table) => ({
    typeIdx: index('template_type_idx').on(table.type),
    scopeIdx: index('template_scope_idx').on(table.scope),
    appIdIdx: index('template_app_idx').on(table.appId),
    createdByIdx: index('template_creator_idx').on(table.createdBy),
  })
);
