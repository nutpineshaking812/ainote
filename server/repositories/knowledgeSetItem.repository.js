import { createBaseRepository } from './base.repository.js';
import { knowledgeSetItems } from '../db/schema/knowledge_set_items.js';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mapResponse } from '../db/utils.js';

/**
 * 知识集内容项仓库
 * 遵循 Drizzle Factory 模式
 */
const KnowledgeSetItemRepository = {
  ...createBaseRepository(knowledgeSetItems),

  /**
   * 按知识集 ID 获取所有关联项，并联表获取资源基本信息
   */
  async findByKnowledgeSet(knowledgeSetId) {
    const { appResources } = await import('../db/schema/index.js');
    const results = await db
      .select({
        knowledgeSetId: knowledgeSetItems.knowledgeSetId,
        resourceId: knowledgeSetItems.resourceId,
        appId: knowledgeSetItems.appId,
        syncStatus: knowledgeSetItems.syncStatus,
        syncError: knowledgeSetItems.syncError,
        createdAt: knowledgeSetItems.createdAt,
        updatedAt: knowledgeSetItems.updatedAt,
        name: sql`${appResources.meta}->>'name'`,
        type: appResources.type,
        refId: appResources.refId,
      })
      .from(knowledgeSetItems)
      .leftJoin(appResources, eq(knowledgeSetItems.resourceId, appResources.id))
      .where(eq(knowledgeSetItems.knowledgeSetId, knowledgeSetId));
      
    return results.map(mapResponse);
  },

  /**
   * 检查某个资源是否已在知识集中
   */
  async exists(knowledgeSetId, resourceId) {
    const [item] = await db
      .select()
      .from(knowledgeSetItems)
      .where(
        and(
          eq(knowledgeSetItems.knowledgeSetId, knowledgeSetId),
          eq(knowledgeSetItems.resourceId, resourceId)
        )
      )
      .limit(1);
    return !!item;
  },

  /**
   * 批量创建 (支持高效批量插入)
   */
  async createMany(dataList) {
    if (!dataList || dataList.length === 0) return [];
    const results = await db
      .insert(knowledgeSetItems)
      .values(dataList)
      .returning();
    return results.map(mapResponse);
  },

  /**
   * 物理移除关联项
   */
  async removeItem(knowledgeSetId, resourceId) {
    return await db
      .delete(knowledgeSetItems)
      .where(
        and(
          eq(knowledgeSetItems.knowledgeSetId, knowledgeSetId),
          eq(knowledgeSetItems.resourceId, resourceId)
        )
      );
  },

  /**
   * 删除知识集下的所有项
   */
  async deleteByKnowledgeSetId(knowledgeSetId) {
    return await db
      .delete(knowledgeSetItems)
      .where(eq(knowledgeSetItems.knowledgeSetId, knowledgeSetId));
  },

  /**
   * 按资源 ID 删除所有关联关系
   */
  async deleteByResourceId(resourceId) {
    return await db
      .delete(knowledgeSetItems)
      .where(eq(knowledgeSetItems.resourceId, resourceId));
  },
  
  /**
   * 查找通用方法
   */
  async find({ where }) {
    let query = db.select().from(knowledgeSetItems);
    if (where) {
      query = query.where(typeof where === 'function' ? where(knowledgeSetItems, await import('drizzle-orm')) : where);
    }
    const results = await query;
    return results.map(mapResponse);
  }
};

export default KnowledgeSetItemRepository;
