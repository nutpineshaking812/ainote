import { varchar, timestamp, text, index, uniqueIndex } from 'drizzle-orm/pg-core';
import crypto from 'crypto';
import { mySchema } from './_base.js';

export const userRecents = mySchema.table(
  'user_recents',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: varchar('user_id', { length: 255 }).notNull(),
    refId: varchar('ref_id', { length: 255 }).notNull(),
    refType: text('ref_type').notNull(),
    organizationId: varchar('organization_id', { length: 255 }),
    lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      userIdIdx: index('user_recents_user_id_idx').on(table.userId),
      lastUsedAtIdx: index('user_recents_last_used_at_idx').on(table.lastUsedAt),
      uniqueRefIdx: uniqueIndex('user_recents_unique_ref_idx').on(table.userId, table.refType, table.refId),
    };
  },
);
