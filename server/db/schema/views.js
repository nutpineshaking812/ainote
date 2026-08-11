import { varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import crypto from 'crypto';
import { mySchema } from './_base.js';

export const views = mySchema.table(
  'views',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    appId: varchar('app_id', { length: 255 }).notNull(),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }),
    layout: jsonb('layout').default([]).notNull(), // [{ componentId, layoutId, x, y, w, h, z, locked }]
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      appIdx: index('views_app_idx').on(table.appId),
      ownerIdx: index('views_owner_idx').on(table.ownerId),
    };
  }
);
