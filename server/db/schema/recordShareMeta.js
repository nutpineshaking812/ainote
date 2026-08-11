import { varchar, timestamp, boolean, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import crypto from 'crypto';
import { mySchema } from './_base.js';

export const recordShareMeta = mySchema.table(
  'record_share_meta',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recordId: varchar('record_id', { length: 255 }).notNull(),
    formId: varchar('form_id', { length: 255 }).notNull(),
    appId: varchar('app_id', { length: 255 }).notNull(),
    
    fieldPermissions: jsonb('field_permissions').default({}).notNull(),
    
    useAccessCode: boolean('use_access_code').default(false).notNull(),
    accessCodeHash: varchar('access_code_hash', { length: 255 }).default('').notNull(),
    
    useExpiry: boolean('use_expiry').default(false).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    
    status: varchar('status', { length: 50 }).default('active').notNull(), // active, revoked, expired
    createdBy: varchar('created_by', { length: 255 }),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      recordIdIdx: uniqueIndex('record_share_meta_record_id_idx').on(table.recordId),
      formIdStatusIdx: index('record_share_meta_form_id_status_idx').on(table.formId, table.status),
      expiresAtIdx: index('record_share_meta_expires_at_idx').on(table.expiresAt),
    };
  }
);
