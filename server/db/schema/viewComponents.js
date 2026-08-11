import { varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import crypto from 'crypto';
import { mySchema } from './_base.js';

export const viewComponents = mySchema.table(
  'view_components',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // chart, table, metric, text, custom
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }),
    source: varchar('source', { length: 50 }).default('manual').notNull(), // aimessage, manual, import, system, other
    sourceId: varchar('source_id', { length: 255 }),
    sourceSegmentId: varchar('source_segment_id', { length: 255 }),
    config: jsonb('config').default({}).notNull(),
    sql: varchar('sql', { length: 8000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      ownerIdx: index('view_components_owner_idx').on(table.ownerId),
      sourceIdx: index('view_components_source_idx').on(table.source, table.sourceId, table.sourceSegmentId),
      ownerTypeIdx: index('view_components_owner_type_idx').on(table.ownerId, table.type, table.name),
    };
  }
);
