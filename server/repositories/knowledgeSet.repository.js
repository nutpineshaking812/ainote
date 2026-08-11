import { knowledgeSets } from '../db/schema/index.js';
import { createBaseRepository } from './base.repository.js';

/**
 * 知识集 Repository
 * 封装对 knowledge_sets 表的原子操作
 */
const ksRepo = createBaseRepository(knowledgeSets);

const KnowledgeSetRepository = {
  ...ksRepo,

  /**
   * 获取应用下的知识集，带上资源总数和已索引总数
   */
  async findByApp(appId) {
    const { db } = await import('../db/index.js');
    const { knowledgeSetItems } = await import('../db/schema/index.js');
    const { sql, eq, desc } = await import('drizzle-orm');

    const results = await db
      .select({
        id: knowledgeSets.id,
        name: knowledgeSets.name,
        description: knowledgeSets.description,
        appRef: knowledgeSets.appRef,
        createdAt: knowledgeSets.createdAt,
        updatedAt: knowledgeSets.updatedAt,
        itemCount: sql`COALESCE(count(${knowledgeSetItems.resourceId}), 0)::int`,
        indexedCount: sql`COALESCE(count(*) filter (where ${knowledgeSetItems.syncStatus} = 'COMPLETED'), 0)::int`,
      })
      .from(knowledgeSets)
      .leftJoin(knowledgeSetItems, eq(knowledgeSets.id, knowledgeSetItems.knowledgeSetId))
      .where(eq(knowledgeSets.appRef, appId))
      .groupBy(knowledgeSets.id)
      .orderBy(desc(knowledgeSets.createdAt));

    return results;
  },

  /**
   * 原子化级联删除：删除知识集主记录、关联项，并清理向量库引用
   */
  async deleteWithCleanup(id) {
    const { db } = await import('../db/index.js');
    const { knowledgeSetItems } = await import('../db/schema/knowledge_set_items.js');
    const { aiVectors } = await import('../db/schema/ai_vectors.js');
    const { eq, sql } = await import('drizzle-orm');

    return await db.transaction(async (tx) => {
      // 1. 删除知识集主记录
      const [deletedKS] = await tx
        .delete(knowledgeSets)
        .where(eq(knowledgeSets.id, id))
        .returning();

      if (!deletedKS) return false;

      // 2. 清理关联项 (Items)
      await tx.delete(knowledgeSetItems).where(eq(knowledgeSetItems.knowledgeSetId, id));

      // 3. 清理向量库中的知识集引用
      const ksId = String(id);
      await tx
        .update(aiVectors)
        .set({
          knowledgeSetIds: sql`array_remove(${aiVectors.knowledgeSetIds}, ${ksId})`,
        })
        .where(sql`${aiVectors.knowledgeSetIds} @> ARRAY[${ksId}]::text[]`);

      return true;
    });
  },
};

export default KnowledgeSetRepository;
