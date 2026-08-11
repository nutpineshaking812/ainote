import { varchar, jsonb, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';

import { mySchema } from './_base.js';

/**
 * User Properties Table Schema
 * Stores arbitrary key-value pairs for users with metadata and change tracking.
 * Located in the 'lc' schema.
 */
export const userProperties = mySchema.table(
  'user_properties',
  {
    userId: varchar('user_id', { length: 255 }).notNull(),
    key: varchar('key', { length: 255 }).notNull(),
    value: jsonb('value'),
    metadata: jsonb('metadata').default({}),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.key] }),
    index('idx_user_props_userid').on(table.userId),
  ]
);
