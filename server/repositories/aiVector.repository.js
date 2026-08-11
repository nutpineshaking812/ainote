import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiVectors } from '../db/schema/ai_vectors.js';
import { createBaseRepository } from './base.repository.js';
import { mapResponse } from '../db/utils.js';

/**
 * AI Vector Repository
 * 封装对 pgvector 向量表的所有持久化操作，严格遵循 db/readme.md 的防越层准则。
 */
class AiVectorRepository {
  constructor() {
    this.base = createBaseRepository(aiVectors);
  }

  /**
   * 获取已有切片的哈希值
   */
  async getExistingHashes({ docId, memoryId, sourceType }) {
    const conditions = [];
    if (docId) conditions.push(eq(aiVectors.docId, String(docId)));
    if (memoryId) conditions.push(eq(aiVectors.docId, String(memoryId)));
    conditions.push(eq(aiVectors.sourceType, sourceType));

    const results = await db
      .select({
        sectionId: aiVectors.sectionId,
        hash: aiVectors.hash,
      })
      .from(aiVectors)
      .where(and(...conditions));

    const hashMap = {};
    results.forEach((r) => {
      if (r.sectionId) {
        hashMap[r.sectionId] = r.hash;
      }
    });
    return hashMap;
  }

  /**
   * 批量更新向量数据 (删除后插入)
   */
  async bulkUpsert(dataToInsert) {
    if (!dataToInsert || dataToInsert.length === 0) return;
    const targetIds = dataToInsert.map((d) => d.id);

    await db.transaction(async (tx) => {
      await tx.delete(aiVectors).where(inArray(aiVectors.id, targetIds));
      await tx.insert(aiVectors).values(dataToInsert);
    });
  }

  /**
   * 搜索最相似的向量
   */
  async searchSimilarVectors(queryVector, limit, appId, filterOptions = {}) {
    const conditions = [];
    if (appId && appId !== 'null' && appId !== 'undefined') {
      conditions.push(eq(aiVectors.appId, String(appId)));
    } else {
      conditions.push(sql`${aiVectors.appId} IS NULL OR ${aiVectors.appId} = ''`);
    }

    // 使用平铺后的 sessionId 过滤
    if (filterOptions.sessionId) {
      conditions.push(eq(aiVectors.sessionId, String(filterOptions.sessionId)));
    }

    // 使用平铺后的 knowledgeSetIds 过滤 (数组包含查询)
    if (
      filterOptions.knowledgeSetIds &&
      Array.isArray(filterOptions.knowledgeSetIds) &&
      filterOptions.knowledgeSetIds.length > 0
    ) {
      // 使用 PostgreSQL 的 && (overlap) 操作符检查交集
      // 显式将 JS 数组转换为 PG ARRAY 构造函数以避免驱动序列化问题
      const ids = filterOptions.knowledgeSetIds.map((id) => sql`${String(id)}`);
      conditions.push(
        sql`${aiVectors.knowledgeSetIds} && ARRAY[${sql.join(ids, sql`, `)}]::text[]`,
      );
    }

    // 执行向量相似度搜索 (Cosine Distance)
    const results = await db
      .select({
        id: aiVectors.id,
        docId: aiVectors.docId,
        content: aiVectors.content,
        metadata: aiVectors.metadata,
        hash: aiVectors.hash,
        header: aiVectors.header,
        sectionId: aiVectors.sectionId,
        updatedAt: aiVectors.updatedAt,
        score: sql`1 - (${aiVectors.vector} <=> ${JSON.stringify(queryVector)}::vector)`,
      })

      .from(aiVectors)
      .where(and(...conditions))
      .orderBy(sql`${aiVectors.vector} <=> ${JSON.stringify(queryVector)}::vector`)
      .limit(limit);

    // 映射 _id 并返回
    return results.map(mapResponse);
  }

  /**
   * 混合搜索：向量相似度 + 全文检索排序 (Hybrid Search)
   * RRF
   */
  async searchHybrid(queryVector, queryText, limit, appId, filterOptions = {}) {
    const conditions = [];
    if (appId && appId !== 'null' && appId !== 'undefined') {
      conditions.push(eq(aiVectors.appId, String(appId)));
    } else {
      conditions.push(sql`${aiVectors.appId} IS NULL OR ${aiVectors.appId} = ''`);
    }

    if (filterOptions.sessionId) {
      conditions.push(eq(aiVectors.sessionId, String(filterOptions.sessionId)));
    }

    if (
      filterOptions.knowledgeSetIds &&
      Array.isArray(filterOptions.knowledgeSetIds) &&
      filterOptions.knowledgeSetIds.length > 0
    ) {
      const ids = filterOptions.knowledgeSetIds.map((id) => sql`${String(id)}`);
      conditions.push(
        sql`${aiVectors.knowledgeSetIds} && ARRAY[${sql.join(ids, sql`, `)}]::text[]`,
      );
    }

    // 使用 sql.raw 将向量字符串直接嵌入 SQL，彻底绕过 Drizzle 的参数处理逻辑，确保稳定性
    const vectorString = `[${queryVector.join(',')}]`;
    const vectorSql = sql.raw(`'${vectorString}'::vector`);

    // RRF 常数，工业标准通常取 60
    const K = 60;

    // 1. 并行获取向量检索和全文检索的原始结果
    const [vectorResults, textResults] = await Promise.all([
      // 向量检索 Top 50
      db
        .select({ id: aiVectors.id })
        .from(aiVectors)
        .where(and(...conditions))
        .orderBy(sql`${aiVectors.vector} <=> ${vectorSql}`)
        .limit(50),

      // 全文检索 Top 50 (使用 OR 逻辑)
      db
        .select({ id: aiVectors.id })
        .from(aiVectors)
        .where(
          and(
            ...conditions,
            sql`to_tsvector('chinese', COALESCE(${aiVectors.header}, '') || ' ' || ${aiVectors.content}) @@ regexp_replace(plainto_tsquery('chinese', ${queryText})::text, '&', '|', 'g')::tsquery`,
          ),
        )
        .orderBy(
          sql`ts_rank(to_tsvector('chinese', COALESCE(${aiVectors.header}, '') || ' ' || ${aiVectors.content}), regexp_replace(plainto_tsquery('chinese', ${queryText})::text, '&', '|', 'g')::tsquery) DESC`,
        )
        .limit(50),
    ]);

    // 2. 计算 RRF 得分
    const scoreMap = new Map();

    vectorResults.forEach((item, index) => {
      const rank = index + 1;
      scoreMap.set(item.id, {
        id: item.id,
        vRank: rank,
        tRank: null,
        rrfScore: 1.0 / (K + rank),
      });
    });

    textResults.forEach((item, index) => {
      const rank = index + 1;
      if (scoreMap.has(item.id)) {
        const data = scoreMap.get(item.id);
        data.tRank = rank;
        data.rrfScore += 1.0 / (K + rank);
      } else {
        scoreMap.set(item.id, {
          id: item.id,
          vRank: null,
          tRank: rank,
          rrfScore: 1.0 / (K + rank),
        });
      }
    });

    // 3. 排序并获取最终的 Top N 数据
    const sortedIds = Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, limit);

    if (sortedIds.length === 0) return [];

    // 4. 回填详细数据
    const finalResults = await db
      .select({
        id: aiVectors.id,
        docId: aiVectors.docId,
        content: aiVectors.content,
        metadata: aiVectors.metadata,
        header: aiVectors.header,
        sectionId: aiVectors.sectionId,
        updatedAt: aiVectors.updatedAt,
        vector: aiVectors.vector, // 拿到向量用于计算 vectorScore
      })
      .from(aiVectors)
      .where(
        inArray(
          aiVectors.id,
          sortedIds.map((d) => d.id),
        ),
      );

    // 5. 组合并格式化返回
    return sortedIds.map((sortItem) => {
      const raw = finalResults.find((r) => r.id === sortItem.id);
      return {
        ...mapResponse(raw),
        score: sortItem.rrfScore, // RRF 总分
        vectorScore: null, // RRF 模式下原分数不再直接相加，此处可留空或单独计算
        headerScore: sortItem.tRank ? 1.0 / (K + sortItem.tRank) : 0,
        contentScore: sortItem.vRank ? 1.0 / (K + sortItem.vRank) : 0,
        rrfDetails: sortItem,
      };
    });
  }

  /**
   * 极速混合搜索：利用单条 CTE SQL 完成所有逻辑
   * 性能最优，减少数据库往返，适合大规模数据
   */
  /**
   * 候选者召回：获取向量 Top 50 和文本 Top 50 的并集
   * 专门为后续 Rerank 流程设计的极速召回方法
   */
  async searchHybridPerformance(queryVector, queryText, limit, appId, filterOptions = {}) {
    const vectorString = `[${queryVector.join(',')}]`;

    // 1. 并行获取两个维度的候选 ID
    const [vectorHits, textHits] = await Promise.all([
      // 向量召回
      db
        .select({ id: aiVectors.id })
        .from(aiVectors)
        .where(
          and(
            appId ? eq(aiVectors.appId, String(appId)) : sql`1=1`,
            filterOptions.knowledgeSetIds?.length > 0
              ? sql`${aiVectors.knowledgeSetIds} && ARRAY[${sql.join(
                  filterOptions.knowledgeSetIds.map((id) => sql`${String(id)}`),
                  sql`, `,
                )}]::text[]`
              : sql`1=1`,
          ),
        )
        .orderBy(sql`${aiVectors.vector} <=> ${vectorString}::vector`)
        .limit(50),

      // 文本召回
      db
        .select({ id: aiVectors.id })
        .from(aiVectors)
        .where(
          and(
            appId ? eq(aiVectors.appId, String(appId)) : sql`1=1`,
            filterOptions.knowledgeSetIds?.length > 0
              ? sql`${aiVectors.knowledgeSetIds} && ARRAY[${sql.join(
                  filterOptions.knowledgeSetIds.map((id) => sql`${String(id)}`),
                  sql`, `,
                )}]::text[]`
              : sql`1=1`,
            sql`to_tsvector('chinese', COALESCE(${aiVectors.header}, '') || ' ' || ${aiVectors.content}) @@ regexp_replace(plainto_tsquery('chinese', ${queryText})::text, '&', '|', 'g')::tsquery`,
          ),
        )
        .orderBy(
          sql`ts_rank(to_tsvector('chinese', COALESCE(${aiVectors.header}, '') || ' ' || ${aiVectors.content}), regexp_replace(plainto_tsquery('chinese', ${queryText})::text, '&', '|', 'g')::tsquery) DESC`,
        )
        .limit(50),
    ]);

    // 2. 取并集并去重
    const allIds = [...new Set([...vectorHits.map((h) => h.id), ...textHits.map((h) => h.id)])];
    if (allIds.length === 0) return [];

    // 3. 一次性回填详细数据
    const finalResults = await db
      .select({
        id: aiVectors.id,
        docId: aiVectors.docId,
        content: aiVectors.content,
        metadata: aiVectors.metadata,
        header: aiVectors.header,
        sectionId: aiVectors.sectionId,
        updatedAt: aiVectors.updatedAt,
      })
      .from(aiVectors)
      .where(inArray(aiVectors.id, allIds));

    return finalResults.map((row) => ({
      ...mapResponse(row),
      content: row.content, // 显式放在根部，供 RerankService 使用
      score: 0,
    }));
  }

  /**
   * 根据 docId 删除向量
   */
  async deleteByDocId(docId) {
    await db.delete(aiVectors).where(eq(aiVectors.docId, String(docId)));
  }

  /**
   * 批量更新文档所有切片的元数据 (不影响向量和内容)
   */
  async updateMetadataByDocId(docId, metadata = {}) {
    const { knowledgeSetIds } = metadata;
    const updateData = {
      updatedAt: new Date(),
    };

    if (knowledgeSetIds) {
      updateData.knowledgeSetIds = knowledgeSetIds;
    }

    await db
      .update(aiVectors)
      .set(updateData)
      .where(eq(aiVectors.docId, String(docId)));
  }

  /**
   * 删除指定的记忆向量
   */
  /**
   * 根据 ID 批量删除向量
   */
  async deleteByIds(ids) {
    if (!ids || ids.length === 0) return;
    await db.delete(aiVectors).where(inArray(aiVectors.id, ids));
  }

  /**
   * 删除指定的记忆向量
   */
  async deleteMemoryVector(memoryId) {
    await db.delete(aiVectors).where(and(eq(aiVectors.docId, String(memoryId)), eq(aiVectors.sourceType, 'memory')));
  }

  /**
   * 从所有向量的 knowledgeSetIds 数组中移除指定的知识集 ID
   */
  async removeFromKnowledgeSet(knowledgeSetId) {
    const ksId = String(knowledgeSetId);
    // 使用 array_remove 函数从数组中移除特定元素
    await db
      .update(aiVectors)
      .set({
        knowledgeSetIds: sql`array_remove(${aiVectors.knowledgeSetIds}, ${ksId})`,
      })
      .where(sql`${aiVectors.knowledgeSetIds} @> ARRAY[${ksId}]::text[]`);
  }
}

export default new AiVectorRepository();
