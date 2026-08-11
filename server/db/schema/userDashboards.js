import { varchar, timestamp, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import crypto from 'crypto';
import { mySchema } from './_base.js';
import { userDashboardItemTypeEnum, userDashboardRefTypeEnum } from './_enums.js';

export const userDashboards = mySchema.table(
  'user_dashboards',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: varchar('user_id', { length: 255 }).notNull(),
    organizationId: varchar('organization_id', { length: 255 }).notNull(),
    itemType: userDashboardItemTypeEnum('item_type').notNull(),
    refType: userDashboardRefTypeEnum('ref_type').notNull(),
    refId: varchar('ref_id', { length: 255 }).notNull(),
    meta: jsonb('meta').default({}).notNull(),
    addedAt: timestamp('added_at').defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at'),
    views: jsonb('views').default([]).notNull(), // array of layout components
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      userIdOrgIdx: index('user_dashboards_user_org_idx').on(table.userId, table.organizationId),
      itemTypeIdx: index('user_dashboards_item_type_idx').on(table.itemType),
      lastUsedAtIdx: index('user_dashboards_last_used_idx').on(table.lastUsedAt),
      uniqueEntryIdx: uniqueIndex('user_dashboards_unique_entry_idx').on(
        table.userId, 
        table.organizationId, 
        table.itemType, 
        table.refType, 
        table.refId
      ),
    };
  },
);
