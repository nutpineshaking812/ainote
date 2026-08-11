import EmbeddingService from './EmbeddingService.js';
import RerankService from './RerankService.js';
import env from '../../config/env.js';
import { splitMarkdownBySections } from '../../utils/markdownUtils.js';
import { blocksToMarkdown } from '../../utils/contentProcessor.js';
import AIMemoryRepository from '../../repositories/aiMemory.repository.js';
import crypto from 'crypto';
import aiVectorRepository from '../../repositories/aiVector.repository.js';
import { db } from '../../db/index.js';
import { aiMemories } from '../../db/schema/index.js';
import { eq, and, sql, inArray, isNull } from 'drizzle-orm';

/**
 * AI 知识库与 RAG 操作中枢
 * 统一使用 PostgreSQL (pgvector) 进行存储与检索
 */
class MemoryService {
  constructor() {
    this._initialized = true; 
  }

  /**
   * 内部方法：获取已有切片的哈希值，支持增量索引
   */
  async _getExistingHashes({ docId, memoryId, sourceType }) {
    try {
      return await aiVectorRepository.getExistingHashes({ docId, memoryId, sourceType });
    } catch (err) {
      console.warn('[MemoryService] Failed to fetch existing hashes', err);
      return {};
    }
  }

  /**
   * 索引文档内容
   */
  async indexDocument(document, metadata = {}) {
    const documentId = String(document.id || document._id);
    const appId = String(document.appId || document.appRef);

    const { knowledgeSetIds = [], ...remainingMetadata } = metadata;

    let content = '';
    if (document.blocks && Array.isArray(document.blocks) && document.blocks.length > 0) {
      content = await blocksToMarkdown(document.blocks);
    } else {
      content = document.contentPlain || document.content || '';
    }

    const { title: docTitle } = document;
    const sections = splitMarkdownBySections(content, { defaultRoot: docTitle });

    const existingHashes = await this._getExistingHashes({
      docId: documentId,
      sourceType: 'document',
    });

    if (sections.length === 0) {
      if (Object.keys(existingHashes).length > 0) {
        await aiVectorRepository.deleteByDocId(documentId);
      }
      return { indexed: 0, skipped: 0, total: 0 };
    }

    // 清理已被删除的段落/切片
    const currentSectionIds = new Set(sections.map((s) => s.sectionId));
    const deletedSectionIds = Object.keys(existingHashes).filter((sid) => !currentSectionIds.has(sid));
    if (deletedSectionIds.length > 0) {
      const deletedIds = deletedSectionIds.map((sid) => this._generatePointId(documentId, sid));
      await aiVectorRepository.deleteByIds(deletedIds);
    }

    const sectionsToProcess = sections.filter((s) => existingHashes[s.sectionId] !== s.hash);

    await aiVectorRepository.updateMetadataByDocId(documentId, { knowledgeSetIds });

    if (sectionsToProcess.length === 0) {
      return { indexed: 0, skipped: sections.length, total: sections.length };
    }

    const textsToEmbed = sectionsToProcess.map((s) => `${s.header}\n${s.content}`);
    const vectors = await EmbeddingService.embedDocuments(textsToEmbed);

    const dataToInsert = sectionsToProcess.map((section, idx) => ({
      id: this._generatePointId(documentId, section.sectionId),
      docId: documentId,
      appId,
      sourceType: 'document',
      vector: vectors[idx],
      content: `${section.header}\n${section.content}`,
      hash: section.hash,
      header: section.header,
      sectionId: section.sectionId,
      knowledgeSetIds: knowledgeSetIds,
      updatedAt: new Date().toISOString(),
      metadata: remainingMetadata,
    }));

    await aiVectorRepository.bulkUpsert(dataToInsert);

    return {
      indexed: sectionsToProcess.length,
      skipped: sections.length - sectionsToProcess.length,
      total: sections.length,
    };
  }

  /**
   * 索引表单的所有记录数据
   */
  async indexForm(formId, metadata = {}) {
    const { formRepository } = await import('../../repositories/form.repository.js');
    const { formRecordRepository } = await import('../../repositories/formRecord.repository.js');

    const form = await formRepository.findById(formId);
    if (!form) throw new Error(`Form not found: ${formId}`);

    const appId = String(form.appId);
    const { knowledgeSetIds = [], ...remainingMetadata } = metadata;

    const records = await formRecordRepository.findByFormIdAll(formId);
    if (records.length === 0) {
      // 如果没有任何填报数据，清理该表单下已有的所有分片向量
      await aiVectorRepository.deleteByDocId(formId);
      return { indexed: 0, skipped: 0, total: 0 };
    }

    const existingHashes = await this._getExistingHashes({
      docId: formId,
      sourceType: 'form_record',
    });

    const formFields = Array.isArray(form.fields) ? form.fields : [];
    const uniqueFields = formFields.filter((f) => f && f.validation?.unique);

    const sections = records.map((record) => {
      const recordId = String(record.id);

      // Helper to convert selection field values to their human-readable labels
      const getFieldValueLabel = (field, val) => {
        if (val === undefined || val === null || val === '') return '';
        const selectionTypes = new Set(['radio-group', 'checkbox-group', 'dropdown', 'dropdown-checkbox', 'ranking']);
        if (selectionTypes.has(field.type)) {
          const opts = Array.isArray(field.properties?.options) ? field.properties.options : [];
          const optionMap = new Map();
          opts.forEach((o) => {
            if (o && o.value != null && o.label != null) {
              optionMap.set(String(o.value), String(o.label));
            }
          });

          if (Array.isArray(val)) {
            return val
              .map((v) => optionMap.get(String(v)) || String(v))
              .filter((v) => v !== '')
              .join(', ');
          } else {
            return optionMap.get(String(val)) || String(val);
          }
        }
        return String(val);
      };

      // 1. 优先使用联合唯一键值拼接作为 RecordTitle
      let recordTitle = '';
      if (uniqueFields.length > 0) {
        recordTitle = uniqueFields
          .map((f) => getFieldValueLabel(f, record.data?.[f.id]))
          .filter((val) => val !== '')
          .join(' - ');
      }

      // 2. 兜底策略：首个文本字段值，再没有用 ID 截取
      if (!recordTitle) {
        const firstTextVal = formFields
          .filter((f) => f && (f.type === 'text' || f.type === 'textarea'))
          .map((f) => getFieldValueLabel(f, record.data?.[f.id]))
          .find((val) => val !== '');
        recordTitle = firstTextVal ? String(firstTextVal) : `记录 #${recordId.slice(-6)}`;
      }

      // 限制标题长度在合理范围，拼装 header
      recordTitle = recordTitle.trim().slice(0, 30);
      const header = `## ${form.name} > ${recordTitle}`;

      // 3. 将其余字段拼装为列表文本，具备 K-V 可读性
      const fieldList = formFields
        .map((f) => {
          if (!f) return null;
          const rawVal = record.data?.[f.id];
          const valLabel = getFieldValueLabel(f, rawVal);
          if (valLabel === '') return null;
          const label = f.properties?.label || f.id;
          return `* ${label}: ${valLabel}`;
        })
        .filter(Boolean)
        .join('\n');

      const content = fieldList || '无具体内容';
      const sectionId = recordId;
      const hash = crypto.createHash('md5').update(header + content).digest('hex');

      return {
        header,
        content,
        sectionId,
        hash,
      };
    });

    // 清理已被删除的表单记录切片
    const currentSectionIds = new Set(sections.map((s) => s.sectionId));
    const deletedSectionIds = Object.keys(existingHashes).filter((sid) => !currentSectionIds.has(sid));
    if (deletedSectionIds.length > 0) {
      const deletedIds = deletedSectionIds.map((sid) => this._generatePointId(`form-${formId}`, sid));
      await aiVectorRepository.deleteByIds(deletedIds);
    }

    const sectionsToProcess = sections.filter((s) => existingHashes[s.sectionId] !== s.hash);

    // 首先更新所有切片的关联 knowledgeSetIds，保障即使数据未变更，元数据也是最新的
    await aiVectorRepository.updateMetadataByDocId(formId, { knowledgeSetIds });

    if (sectionsToProcess.length === 0) {
      return { indexed: 0, skipped: sections.length, total: sections.length };
    }

    const textsToEmbed = sectionsToProcess.map((s) => `${s.header}\n${s.content}`);
    const vectors = await EmbeddingService.embedDocuments(textsToEmbed);

    const dataToInsert = sectionsToProcess.map((section, idx) => ({
      id: this._generatePointId(`form-${formId}`, section.sectionId),
      docId: formId,
      appId,
      sourceType: 'form_record',
      vector: vectors[idx],
      content: `${section.header}\n${section.content}`,
      hash: section.hash,
      header: section.header,
      sectionId: section.sectionId,
      knowledgeSetIds: knowledgeSetIds,
      updatedAt: new Date().toISOString(),
      metadata: {
        ...remainingMetadata,
        recordId: section.sectionId,
      },
    }));

    await aiVectorRepository.bulkUpsert(dataToInsert);

    return {
      indexed: sectionsToProcess.length,
      skipped: sections.length - sectionsToProcess.length,
      total: sections.length,
    };
  }

  /**
   * 索引对话记忆卡片
   */
  async indexMemoryCard(memory) {
    const memoryId = String(memory.id || memory._id);
    const appId = String(memory.appId);

    const { userId, blocks, sessionId, sessionName, category, ...otherMemoryInfo } = memory;

    const markdown = await blocksToMarkdown(blocks);
    const sections = splitMarkdownBySections(markdown, { defaultRoot: '' });

    const existingHashes = await this._getExistingHashes({
      memoryId,
      sourceType: 'memory',
    });

    if (sections.length === 0) {
      if (Object.keys(existingHashes).length > 0) {
        await aiVectorRepository.deleteMemoryVector(memoryId);
      }
      return { indexed: 0, skipped: 0, total: 0 };
    }

    // 清理已被删除的记忆切片
    const currentSectionIds = new Set(sections.map((s) => s.sectionId));
    const deletedSectionIds = Object.keys(existingHashes).filter((sid) => !currentSectionIds.has(sid));
    if (deletedSectionIds.length > 0) {
      const deletedIds = deletedSectionIds.map((sid) => this._generatePointId(`mem-${memoryId}`, sid));
      await aiVectorRepository.deleteByIds(deletedIds);
    }

    const sectionsToProcess = sections.filter((s) => existingHashes[s.sectionId] !== s.hash);

    if (sectionsToProcess.length === 0) {
      return { indexed: 0, skipped: sections.length, total: sections.length };
    }

    const textsToEmbed = sectionsToProcess.map((s) => `${s.header}\n${s.content}`);
    const vectors = await EmbeddingService.embedDocuments(textsToEmbed);

    const dataToInsert = sectionsToProcess.map((section, idx) => ({
      id: this._generatePointId(`mem-${memoryId}`, section.sectionId),
      docId: memoryId,
      appId,
      sourceType: 'memory',
      vector: vectors[idx],
      content: `${section.header}\n${section.content}`,
      hash: section.hash,
      header: section.header,
      sectionId: section.sectionId,
      sessionId,
      updatedAt: new Date().toISOString(),
      metadata: {
        memoryId,
        sessionName,
        category,
        userId: userId ? String(userId) : undefined,
        ...otherMemoryInfo,
      },
    }));

    await aiVectorRepository.bulkUpsert(dataToInsert);

    return {
      indexed: sectionsToProcess.length,
      skipped: sections.length - sectionsToProcess.length,
      total: sections.length,
    };
  }

  /**
   * 搜索最相关的记忆/切片
   */
  async search(appId, query, options = {}) {
    const queryVector = await EmbeddingService.embedQuery(query);
    const limit = options.limit || 5;

    const results = await aiVectorRepository.searchSimilarVectors(
      queryVector,
      limit,
      appId,
      options.filter || {},
    );

    return results.map((r) => ({
      id: r.id,
      score: r.score,
      payload: {
        ...r.metadata,
        docId: r.docId,
        content: r.content,
        sectionId: r.sectionId,
        header: r.header,
        hash: r.hash,
        updatedAt: r.updatedAt,
      },
    }));
  }

  /**
   * 混合搜索：结合语义和关键词 (Hybrid Search)
   */
  async hybridSearch(appId, query, options = {}) {
    const queryVector = await EmbeddingService.embedQuery(query);
    const limit = options.limit || 5;

    const results = await aiVectorRepository.searchHybridPerformance(
      queryVector,
      query,
      limit,
      appId,
      options.filter || {},
    );

    const rawResults = results.map((r) => ({
      id: r.id,
      score: r.score,
      vectorScore: r.vectorScore,
      headerScore: r.headerScore,
      contentScore: r.contentScore,
      payload: {
        ...r.metadata,
        docId: r.docId,
        content: r.content,
        sectionId: r.sectionId,
        header: r.header,
        hash: r.hash,
        updatedAt: r.updatedAt,
      },
      content: r.content,
    }));

    if (options.rerank !== false) {
      console.log(`[Memory] Reranking ${rawResults.length} candidates...`);
      return await RerankService.rerank(query, rawResults, limit);
    }

    return rawResults;
  }

  /**
   * 从索引中移除文档
   */
  async unindexDocument(docId) {
    await aiVectorRepository.deleteByDocId(docId);
  }

  /**
   * 从索引中移除记忆
   */
  async unindexMemoryCard(memoryId) {
    await aiVectorRepository.deleteMemoryVector(memoryId);
  }

  /**
   * 删除单张记忆卡片
   */
  async removeMemoryCard(cardId, userId) {
    const card = await AIMemoryRepository.findById(cardId);
    if (!card) return { success: false, message: 'Card not found' };
    
    // Ownership check
    if (userId && card.userId !== userId.toString()) {
      throw new Error('Unauthorized deletion of memory card');
    }

    await AIMemoryRepository.delete(cardId);
    await this.unindexMemoryCard(cardId);
    return { success: true };
  }

  /**
   * 删除整个会话的记忆
   */
  async removeMemorySession(appId, sessionId, userId) {
    const filters = [eq(aiMemories.userId, userId.toString())];
    
    if (appId === 'global' || !appId) {
      filters.push(isNull(aiMemories.appId));
    } else {
      filters.push(eq(aiMemories.appId, appId.toString()));
    }

    if (!sessionId || sessionId === 'null') {
      filters.push(isNull(aiMemories.sessionId));
    } else {
      filters.push(eq(aiMemories.sessionId, sessionId));
    }

    const cards = await db.select().from(aiMemories).where(and(...filters));
    const cardIds = cards.map(c => c.id);

    if (cardIds.length > 0) {
      await db.delete(aiMemories).where(inArray(aiMemories.id, cardIds));
      for (const id of cardIds) {
        await this.unindexMemoryCard(id);
      }
    }

    return { success: true, deletedCount: cardIds.length };
  }

  /**
   * 辅助方法：生成确定的 UUID 以支持语义幂等
   */
  _generatePointId(sourceId, sectionId) {
    const hash = crypto.createHash('md5').update(`${sourceId}-${sectionId}`).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  }
}

export default new MemoryService();
