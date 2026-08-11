import resourceEvents from './resource.events.js';
import { RESOURCE_EVENTS } from '../constants/events.js';
import knowledgeSetItemRepository from '../repositories/knowledgeSetItem.repository.js';
import documentService from './document.service.js';
import memoryService from './memory/MemoryService.js';
import knowledgeSetService from './knowledgeSet.service.js';
import ResourceRepository from '../repositories/resource.repository.js';
import { logger } from '../config/logger.js';

/**
 * AI 知识库自动同步中枢
 */
class KnowledgeSynchronizer {
  constructor() {
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    logger.info('[KnowledgeSync] Initializing AI Knowledge Synchronizer...');

    // 监听资源更新事件
    resourceEvents.on(RESOURCE_EVENTS.UPDATED, async (data) => {
      try {
        await this.handleResourceUpdate(data);
      } catch (err) {
        logger.error({ err, data }, '[KnowledgeSync] Failed to handle update');
      }
    });

    // 监听资源删除事件
    resourceEvents.on(RESOURCE_EVENTS.DELETED, async (data) => {
      try {
        await this.handleResourceDelete(data);
      } catch (err) {
        logger.error({ err, data }, '[KnowledgeSync] Failed to handle deletion');
      }
    });

    this.isInitialized = true;
  }

  /**
   * 处理资源更新
   */
  async handleResourceUpdate({ resourceId, type, isLocallyEmitted }) {
    // 仅处理文档与表单类型的资源
    if (!isLocallyEmitted || (type !== 'document' && type !== 'form')) return;

    try {
      // 1. 获取资源详情以拿到 refId (即 document ID)
      let resource = await ResourceRepository.findById(resourceId);
      if (!resource) {
        // 尝试通过 refId (即 document ID) 查找资源记录
        resource = await ResourceRepository.findOne({
          where: (t, d) => d.and(d.eq(t.refId, resourceId), d.eq(t.deleted, false)),
        });
      }

      if (!resource || !resource.refId) {
        return; // 可能是中间状态
      }

      const actualResourceId = resource.id;

      // 2. 查询当前所属的所有知识集
      const items = await knowledgeSetItemRepository.find({
        where: (t, d) => d.eq(t.resourceId, actualResourceId),
      });

      const knowledgeSetIds = items.map((it) => it.knowledgeSetId);

      // 3. 将这些知识集下的关联项同步状态变更为 PENDING (待同步)
      for (const ksId of knowledgeSetIds) {
        await knowledgeSetService.updateItemStatus(ksId, actualResourceId, { status: 'PENDING' });
      }
      
      logger.info(`[KnowledgeSync] Marked resource ${actualResourceId} as PENDING in ${knowledgeSetIds.length} sets`);
    } catch (err) {
      logger.error({ resourceId, err: err.message }, '[KnowledgeSync] Failed to mark as PENDING');
    }
  }

  /**
   * 处理资源删除
   */
  async handleResourceDelete({ resourceId, type, isLocallyEmitted }) {
    if (!isLocallyEmitted || (type !== 'document' && type !== 'form')) return;

    try {
      let resource = await ResourceRepository.findOne({
        where: (t, d) => d.and(d.eq(t.refId, resourceId), d.eq(t.deleted, false)),
      });
      if (!resource) {
        resource = await ResourceRepository.findById(resourceId);
      }

      const targetId = resource?.refId || resourceId;
      const uuid = resource?.id;

      logger.info(`[KnowledgeSync] Resource deleted, unindexing: ${targetId}`);
      await memoryService.unindexDocument(targetId);

      // 同步清理知识库关联关系表数据
      if (uuid) {
        logger.info(`[KnowledgeSync] Cleaning up knowledge set item associations for: ${uuid}`);
        await knowledgeSetItemRepository.deleteByResourceId(uuid);
      }
    } catch (err) {
      logger.error({ resourceId, err: err.message }, '[KnowledgeSync] Delete cleanup failed');
    }
  }
}

const syncInstance = new KnowledgeSynchronizer();
export default syncInstance;
