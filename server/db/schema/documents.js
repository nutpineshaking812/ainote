import { varchar, text, timestamp, index, jsonb, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { mySchema, timestampCoerced } from './_base.js';
import { documentTypeEnum, documentPurposeEnum } from './_enums.js';

export const documents = mySchema.table(
  'documents',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    docType: documentTypeEnum('doc_type').default('general').notNull(),
    appRef: varchar('app_ref', { length: 255 }),
    title: varchar('title', { length: 255 }).default('').notNull(),
    blocks: jsonb('blocks').default([]).notNull(),
    contentPlain: text('content_plain').default('').notNull(),
    attachments: jsonb('attachments').default([]).notNull(),
    originalFileId: varchar('original_file_id', { length: 255 }),
    tags: varchar('tags', { length: 255 }).array().default([]).notNull(),
    purpose: documentPurposeEnum('purpose').default('NORMAL').notNull(),
    skillName: varchar('skill_name', { length: 255 }),
    description: text('description'),
    parameters: jsonb('parameters').default({}).notNull(),
    createdBy: varchar('created_by', { length: 255 }),
    updatedBy: varchar('updated_by', { length: 255 }),
    shares: jsonb('shares').default([]).notNull(),
    createdAt: timestampCoerced('created_at').default(sql`now()`).notNull(),
    updatedAt: timestampCoerced('updated_at').default(sql`now()`).notNull(),
  },
  (table) => {
    return {
      docTypeIdx:        index('documents_doc_type_idx').on(table.docType),
      appRefIdx:         index('documents_app_ref_idx').on(table.appRef),
      createdByIdx:      index('documents_created_by_idx').on(table.createdBy),
      originalFileIdIdx: index('documents_original_file_id_idx').on(table.originalFileId),
      appRefDocTypeIdx:  index('documents_app_ref_doc_type_idx').on(table.appRef, table.docType),

      // ── DatabaseBackend 专用索引 ──────────────────────────────────────────
      // findOneBySkillName：WHERE app_ref = ? AND skill_name = ?  (最频繁路径)
      appRefSkillNameIdx: index('documents_app_ref_skill_name_idx').on(table.appRef, table.skillName),
      // findOneBySkillName 的 title 回退：WHERE app_ref = ? AND title = ?
      appRefTitleIdx:     index('documents_app_ref_title_idx').on(table.appRef, table.title),
      // getAccessQuery：shares @> '[{"targetType":"ALL"}]'::jsonb  (每次权限过滤)
      sharesGinIdx:       index('documents_shares_gin_idx').using('gin', table.shares),
    };
  },

);
