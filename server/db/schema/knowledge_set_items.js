import { varchar, timestamp, primaryKey, index, text } from 'drizzle-orm/pg-core';
import { mySchema } from './_base.js';
import { knowledgeSets } from './knowledge_sets.js';
import { appResources } from './appResources.js';

/**
 * 知识集内容项表 (统一资源关联表)
 * 与 app_resources 进行解耦式关联，支持文档、表单、文件夹等任何资源项入库
 */
export const knowledgeSetItems = mySchema.table(
  'knowledge_set_items',
  {
    knowledgeSetId: varchar('knowledge_set_id', { length: 255 })
      .notNull()
      .references(() => knowledgeSets.id, { onDelete: 'cascade' }),
    
    // 统一指向 app_resources 的主键 ID
    resourceId: varchar('resource_id', { length: 255 })
      .notNull()
      .references(() => appResources.id, { onDelete: 'cascade' }),

    // 冗余存储 appId，便于快速索引与隔离
    appId: varchar('app_id', { length: 255 }).notNull(),

    // 同步状态：PENDING(等待), INDEXING(同步中), COMPLETED(已完成), FAILED(失败)
    syncStatus: varchar('sync_status', { length: 50 }).default('PENDING').notNull(),
    
    // 失败原因 (可选)
    syncError: text('sync_error'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.knowledgeSetId, table.resourceId] }),
      ksIdx: index('ks_items_ks_id_idx').on(table.knowledgeSetId),
      appIdx: index('ks_items_app_id_idx').on(table.appId),
      statusIdx: index('ks_items_status_idx').on(table.syncStatus),
    };
  },
);
