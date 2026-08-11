import { varchar, text, index } from 'drizzle-orm/pg-core';
import crypto from 'crypto';
import { mySchema, timestampCoerced } from './_base.js';
import { sql } from 'drizzle-orm';

/**
 * 知识集 (Knowledge Sets) - PostgreSQL 版
 * 代表一组相关联的知识，用于 AI 检索或文档分类。
 */
export const knowledgeSets = mySchema.table(
  'knowledge_sets',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').default(''),
    appRef: varchar('app_ref', { length: 255 }).notNull(), // 归属应用
    
    createdBy: varchar('created_by', { length: 255 }),
    updatedBy: varchar('updated_by', { length: 255 }),
    
    createdAt: timestampCoerced('created_at').default(sql`now()`).notNull(),
    updatedAt: timestampCoerced('updated_at').default(sql`now()`).notNull(),
  },
  (table) => {
    return {
      appRefIdx: index('ks_app_ref_idx').on(table.appRef),
      nameIdx: index('ks_name_idx').on(table.name),
    };
  },
);
