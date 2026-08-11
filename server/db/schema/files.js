import { text, integer, jsonb, uuid, timestamp } from 'drizzle-orm/pg-core';
import { mySchema, timestampCoerced } from './_base.js';

/**
 * Storage Provider Enum
 */
export const storageProviderEnum = mySchema.enum('storage_provider', [
  'local', 
  's3', 
  'oss', 
  'gcs', 
  'qiniu'
]);

/**
 * File Status Enum
 */
export const fileStatusEnum = mySchema.enum('file_status', [
  'temp', 
  'available', 
  'archived', 
  'deleted'
]);

/**
 * Files Table
 * Stores metadata for all uploaded resources across providers.
 */
export const files = mySchema.table('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  provider: storageProviderEnum('provider').default('local').notNull(),
  key: text('key').notNull(), // provider-specific key (relative path for local)
  mime: text('mime'),
  size: integer('size'),
  status: fileStatusEnum('status').default('available').notNull(),
  refCount: integer('ref_count').default(0).notNull(),
  createdBy: text('created_by'),
  meta: jsonb('meta').default({}),
  usageType: text('usage_type'),
  usageId: text('usage_id'),
  createdAt: timestampCoerced('created_at').notNull().$defaultFn(() => new Date()),
  updatedAt: timestampCoerced('updated_at').notNull().$defaultFn(() => new Date()),
});
