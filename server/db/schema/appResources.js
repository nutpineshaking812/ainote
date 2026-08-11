import { varchar, integer, boolean, timestamp, index, uniqueIndex, jsonb, text } from 'drizzle-orm/pg-core';
import crypto from 'crypto';
import { mySchema } from './_base.js';


export const appResources = mySchema.table(
  'app_resources',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    appId: varchar('app_id', { length: 255 }).notNull(),
    type: text('type').notNull(),
    refId: varchar('ref_id', { length: 255 }).notNull(),
    parentId: varchar('parent_id', { length: 255 }),
    order: varchar('order', { length: 1024 }).default('m').notNull(),
    meta: jsonb('meta').default({}).notNull(), // name, desc, icon, categoryKeys
    hidden: boolean('hidden').default(false).notNull(),
    pinned: boolean('pinned').default(false).notNull(),
    deleted: boolean('deleted').default(false).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      appIdIdx: index('app_resources_app_id_idx').on(table.appId),
      parentIdIdx: index('app_resources_parent_id_idx').on(table.parentId),
      deletedIdx: index('app_resources_deleted_idx').on(table.deleted),
      orderIdx: index('app_resources_compound_order_idx').on(table.appId, table.parentId, table.order),
      uniqueRefIdx: uniqueIndex('app_resources_unique_ref_idx').on(table.appId, table.type, table.refId),
    };
  },
);
