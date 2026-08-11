import { varchar, text, timestamp, index, jsonb, customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { mySchema, timestampCoerced } from './_base.js';

/**
 * 向量存储表定义
 * 用于存储文档切片及其对应的向量特征值
 */
const vector = customType({
  dataType() {
    return 'vector(1024)';
  },
  toDriver(value) {
    if (Array.isArray(value)) {
      return `[${value.join(',')}]`;
    }
    return value;
  },
  fromDriver(value) {
    if (typeof value === 'string') {
      return value
        .slice(1, -1)
        .split(',')
        .map((v) => parseFloat(v));
    }
    return value;
  },
});

export const aiVectors = mySchema.table(
  'ai_vectors',
  {
    // 1. 核心标识
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    appId: varchar('app_id', { length: 255 }).notNull(),
    docId: varchar('doc_id', { length: 255 }).notNull(),

    // 2. 管理与同步字段
    sourceType: varchar('source_type', { length: 50 }).default('document').notNull(),
    sectionId: varchar('section_id', { length: 255 }),
    hash: varchar('hash', { length: 64 }),

    // 3. 检索过滤器
    sessionId: varchar('session_id', { length: 255 }),
    knowledgeSetIds: text('knowledge_set_ids').array(),

    // 4. 核心载荷 (大数据量字段放在后面)
    vector: vector('vector').notNull(),
    content: text('content').notNull(),
    header: text('header'),

    // 5. 全文检索向量 (Drizzle 目前对 Generated Column 支持有限，这里先定义字段，同步通过 SQL 触发)
    // searchVector: customType({ dataType: () => 'tsvector' })('search_vector'),

    // 5. 动态扩展与审计
    metadata: jsonb('metadata').default({}).notNull(),
    updatedAt: timestampCoerced('updated_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    docIdIdx: index('ai_vectors_doc_id_idx').on(table.docId),
    appIdIdx: index('ai_vectors_app_id_idx').on(table.appId),
    sessionIdIdx: index('ai_vectors_session_id_idx').on(table.sessionId),
    sectionIdIdx: index('ai_vectors_section_id_idx').on(table.sectionId),
    ksIdx: index('ai_vectors_ks_idx').using('gin', table.knowledgeSetIds),
    // 新增：中文全文检索 GIN 索引，加速混合检索中的关键词匹配
    contentTsvIdx: index('ai_vectors_content_tsv_idx').using(
      'gin',
      sql`to_tsvector('chinese', ${table.content})`,
    ),
  }),
);
