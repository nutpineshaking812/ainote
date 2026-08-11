import { pgTable, varchar, text, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { mySchema, timestampCoerced } from './_base.js';
import crypto from 'crypto';

export const users = mySchema.table(
  'users',
  {
    id: varchar('id', { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    username: varchar('username', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    password: text('password').notNull(),
    nickname: varchar('nickname', { length: 255 }),
    avatar: text('avatar'),
    invitedBy: varchar('invited_by', { length: 255 }),
    status: varchar('status', { length: 50 }).default('ACTIVE').notNull(),
    systemRole: varchar('system_role', { length: 50 }).default('USER').notNull(),
    lastLogin: timestampCoerced('last_login'),
    createdAt: timestampCoerced('created_at').default(sql`now()`).notNull(),
    updatedAt: timestampCoerced('updated_at').default(sql`now()`).notNull(),
  },
  (table) => ({
    usernameIdx: uniqueIndex('users_username_idx').on(table.username),
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  })
);
