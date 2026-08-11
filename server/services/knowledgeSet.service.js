import KnowledgeSetRepository from '../repositories/knowledgeSet.repository.js';
import KnowledgeSetItemRepository from '../repositories/knowledgeSetItem.repository.js';
import ResourceRepository from '../repositories/resource.repository.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * 知识集 Service
 * 核心职能：维护知识聚合逻辑，并与向量库保持同步
 */

const getKnowledgeSets = async (appId) => {
  return KnowledgeSetRepository.findByApp(appId);
};

const getKnowledgeSetById = async (id) => {
  const ks = await KnowledgeSetRepository.findById(id);
  if (!ks) {
    throw ApiError.notFound('Knowledge set not found', 'KS_NOT_FOUND');
  }
  return ks;
};

const createKnowledgeSet = async (appId, { name, description }, userId) => {
  if (!name) {
    throw ApiError.badRequest('Knowledge set name is required', 'KS_NAME_REQUIRED');
  }

  return KnowledgeSetRepository.create({
    appRef: appId,
    name,
    description: description || '',
    createdBy: userId,
    updatedBy: userId,
  });
};

const updateKnowledgeSet = async (id, { name, description }, userId) => {
  const result = await KnowledgeSetRepository.update(id, {
    name,
    description,
    updatedBy: userId,
  });

  if (!result) {
    throw ApiError.notFound('Knowledge set not found', 'KS_NOT_FOUND');
  }

  return result;
};

const deleteKnowledgeSet = async (id) => {
  // 1. 验证是否存在
  await getKnowledgeSetById(id);

  // 2. 执行原子化级联删除 (内部包含事务)
  const success = await KnowledgeSetRepository.deleteWithCleanup(id);
  
  if (!success) {
    throw ApiError.notFound('Knowledge set not found', 'KS_NOT_FOUND');
  }

  return true;
};

// --- Item Management ---

/**
 * 批量为知识集添加资源项 (文档、表单或文件夹)
 */
const addItems = async (id, { resourceIds }, userId) => {
  const ks = await getKnowledgeSetById(id);

  if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
    throw ApiError.badRequest('resourceIds array is required', 'IDS_REQUIRED');
  }

  // 1. 过滤掉已经存在的资源，防止重复插入
  const existingItems = await KnowledgeSetItemRepository.findByKnowledgeSet(id);
  const existingIds = new Set(existingItems.map((it) => it.resourceId));
  const newIds = resourceIds.filter((rid) => !existingIds.has(rid));

  if (newIds.length === 0) {
    return { addedCount: 0, message: 'All items already exist in this set' };
  }

  // 2. 批量创建记录
  const dataToInsert = newIds.map((rid) => ({
    knowledgeSetId: id,
    resourceId: rid,
    appId: ks.appRef,
    syncStatus: 'INDEXING',
  }));

  const result = await KnowledgeSetItemRepository.createMany(dataToInsert);

  // 3. 异步触发立即同步/向量化
  newIds.forEach((rid) => {
    syncItem(ks.appRef, id, rid).catch((err) => {
      console.error(`[KnowledgeSet] Immediate sync after addItems failed for resource ${rid}:`, err.message);
    });
  });

  return { addedCount: newIds.length, items: result };
};

/**
 * 更新项的同步状态 (供同步器回写)
 */
const updateItemStatus = async (knowledgeSetId, resourceId, { status, error }) => {
  return KnowledgeSetItemRepository.update(
    { knowledgeSetId, resourceId },
    {
      syncStatus: status,
      syncError: error || null,
      updatedAt: new Date(),
    },
  );
};

const getItems = async (id) => {
  const items = await KnowledgeSetItemRepository.findByKnowledgeSet(id);
  if (!items || items.length === 0) return [];

  const docIds = [];
  const formIds = [];
  const viewIds = [];

  for (const it of items) {
    if (!it.refId) continue;
    if (it.type === 'document') {
      docIds.push(it.refId.toString());
    } else if (it.type === 'form') {
      formIds.push(it.refId.toString());
    } else if (it.type === 'view') {
      viewIds.push(it.refId.toString());
    }
  }

  const [
    { default: DocumentRepository },
    { formRepository },
    { default: ViewRepository },
    { inArray }
  ] = await Promise.all([
    import('../repositories/document.repository.js'),
    import('../repositories/form.repository.js'),
    import('../repositories/view.repository.js'),
    import('drizzle-orm')
  ]);

  const [docs, forms, views] = await Promise.all([
    docIds.length > 0
      ? DocumentRepository.findAll({
          where: (t) => inArray(t.id, docIds),
        })
      : Promise.resolve([]),
    formIds.length > 0
      ? formRepository.findAll({
          where: (t) => inArray(t.id, formIds),
        })
      : Promise.resolve([]),
    viewIds.length > 0
      ? ViewRepository.find({
          where: (t) => inArray(t.id, viewIds),
        })
      : Promise.resolve([]),
  ]);

  const docMap = new Map(docs.map((d) => [d.id.toString(), d]));
  const formMap = new Map(forms.map((f) => [f.id.toString(), f]));
  const viewMap = new Map(views.map((v) => [v.id.toString(), v]));

  return items.map((it) => {
    let resolvedName = it.name;
    if (it.type === 'document' && it.refId) {
      resolvedName = docMap.get(it.refId.toString())?.title || resolvedName;
    } else if (it.type === 'form' && it.refId) {
      resolvedName = formMap.get(it.refId.toString())?.name || resolvedName;
    } else if (it.type === 'view' && it.refId) {
      resolvedName = viewMap.get(it.refId.toString())?.name || resolvedName;
    }
    return {
      ...it,
      name: resolvedName || '未命名',
    };
  });
};

/**
 * 移除资源项
 * 修复逻辑：支持无限层级文件夹递归清理
 */
const removeItem = async (id, { resourceId }) => {
  const item = await KnowledgeSetItemRepository.find({
    where: (t, d) => d.and(d.eq(t.knowledgeSetId, id), d.eq(t.resourceId, resourceId)),
  }).then(res => res[0]);

  if (!item) return { success: false };

  const result = await KnowledgeSetItemRepository.removeItem(id, resourceId);

  // 递归寻找所有受影响的资源 ID (UUID)
  const affectedIds = await _resolveAllResourceIdsUnder(resourceId);

  // 更新底层向量数据库的元数据 (剔除已删除的知识库关联)
  const { default: aiVectorRepository } = await import('../repositories/aiVector.repository.js');
  for (const rid of affectedIds) {
    const resource = await ResourceRepository.findById(rid);
    if (resource && resource.refId) {
      const remainingKsIds = await getKnowledgeSetIdsForResource(rid);
      await aiVectorRepository.updateMetadataByDocId(resource.refId, { knowledgeSetIds: remainingKsIds });
    }
  }
  
  const resourceEvents = (await import('./resource.events.js')).default;
  affectedIds.forEach((rid) => {
    resourceEvents.emitUpdated({
      resourceId: rid,
      type: 'document',
      appId: item.appId,
    });
  });

  return { success: true, count: affectedIds.length };
};

/**
 * 递归解析出某个资源下所有的文档 ID (UUID版)
 */
const _resolveAllResourceIdsUnder = async (rootId) => {
  const results = [];
  const root = await ResourceRepository.findById(rootId);
  if (!root || root.deleted) return [];

  // 如果根就是文档或表单，直接加入
  if (root.type === 'document' || root.type === 'form') {
    results.push(rootId);
    return results;
  }

  // 如果是文件夹，深度优先遍历
  const queue = [rootId];
  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await ResourceRepository.findAll({
      where: (t, d) => d.and(d.eq(t.parentId, currentId), d.eq(t.deleted, false)),
    });

    for (const child of children) {
      if (child.type === 'document' || child.type === 'form') {
        results.push(child.id);
      }
      // 不管是不是文档，只要不是叶子就继续向下探测 (文档也可以作为容器)
      queue.push(child.id);
    }
  }

  return results;
};

/**
 * 递归解析出知识集下所有生效的文档 ID
 */
const getEffectiveDocumentIds = async (id) => {
  const items = await getItems(id);
  const docIds = new Set();

  for (const item of items) {
    const resource = await ResourceRepository.findById(item.resourceId);
    if (!resource || resource.deleted) continue;

    if (resource.type === 'document' || resource.type === 'form') {
      docIds.add(resource.refId);
    } else {
      const children = await _resolveAllDocumentsUnder(resource.id);
      children.forEach((cid) => docIds.add(cid));
    }
  }

  return Array.from(docIds);
};

/**
 * 内部私有方法：递归获取某个文件夹资源下的所有文档 refId (用于同步)
 */
const _resolveAllDocumentsUnder = async (parentId) => {
  const results = [];
  const queue = [parentId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await ResourceRepository.findAll({
      where: (t, d) => d.and(d.eq(t.parentId, currentId), d.eq(t.deleted, false)),
    });

    for (const child of children) {
      if (child.type === 'document' || child.type === 'form') {
        results.push(child.refId);
      }
      queue.push(child.id);
    }
  }

  return results;
};

const testRetrieval = async (appId, id, query, limit = 5) => {
  const { default: MemoryService } = await import('./memory/MemoryService.js');
  
  const filter = { knowledgeSetIds: [String(id)] };
  const searchResults = await MemoryService.hybridSearch(appId, query, {
    limit,
    filter,
  });

  const docIds = [...new Set(searchResults.map((r) => r.payload.docId).filter(Boolean))];
  const docMap = {};
  if (docIds.length > 0) {
    const resources = await ResourceRepository.findAll({
      where: (t, d) => d.and(d.inArray(t.refId, docIds), d.eq(t.deleted, false)),
    });
    const { default: resourceService } = await import('./resource.service.js');
    const resolved = await resourceService.resolveResourcesMetadata(resources);
    resolved.forEach((r) => {
      docMap[r.refId] = {
        name: r.meta?.name || r.refId,
        type: r.type,
      };
    });
  }

  return searchResults.map((r) => ({
    id: r.id,
    score: r.score,
    vectorScore: r.vectorScore,
    headerScore: r.headerScore,
    contentScore: r.contentScore,
    content: r.content,
    header: r.payload.header,
    sectionId: r.payload.sectionId,
    docId: r.payload.docId,
    docName: docMap[r.payload.docId]?.name || 'Unknown Document',
    docType: docMap[r.payload.docId]?.type || 'document',
  }));
};

/**
 * 递归计算某个资源项归属的所有知识库 ID
 */
const getKnowledgeSetIdsForResource = async (resourceId) => {
  const parentIds = [];
  let currentId = resourceId;
  while (currentId) {
    const res = await ResourceRepository.findById(currentId);
    if (!res || !res.parentId) break;
    parentIds.push(res.parentId);
    currentId = res.parentId;
  }

  const allIds = [resourceId, ...parentIds];

  const items = await KnowledgeSetItemRepository.find({
    where: (t, d) => d.inArray(t.resourceId, allIds),
  });

  return Array.from(new Set(items.map((it) => String(it.knowledgeSetId))));
};

const syncItem = async (appId, id, resourceId) => {
  const { default: MemoryService } = await import('./memory/MemoryService.js');

  // 1. 设置状态为 INDEXING
  await updateItemStatus(id, resourceId, { status: 'INDEXING' });

  try {
    // 2. 获取资源详情以拿到 refId
    const resource = await ResourceRepository.findById(resourceId);
    if (!resource || !resource.refId) {
      throw new Error('Resource or reference ID not found');
    }

    // 获取该资源归属的所有有效知识库 ID，合并写入向量以防止覆盖
    const allKsIds = await getKnowledgeSetIdsForResource(resource.id);

    if (resource.type === 'document') {
      const { default: documentService } = await import('./document.service.js');
      const doc = await documentService.getSingle(resource.refId);
      if (!doc) {
        // 如果文档内容没了，执行清理并抛出错误
        await MemoryService.unindexDocument(resource.refId);
        throw new Error('Document content not found');
      }

      // 3. 执行向量化/元数据更新
      await MemoryService.indexDocument(doc, { knowledgeSetIds: allKsIds });
    } else if (resource.type === 'form') {
      // 3. 执行表单向量化/元数据更新
      await MemoryService.indexForm(resource.refId, { knowledgeSetIds: allKsIds });
    } else {
      throw new Error(`Unsupported resource type for synchronization: ${resource.type}`);
    }

    // 4. 更新同步状态为 COMPLETED
    await updateItemStatus(id, resourceId, { status: 'COMPLETED' });
    return { success: true };
  } catch (err) {
    // 5. 更新同步状态为 FAILED，并记录错误详情
    await updateItemStatus(id, resourceId, { status: 'FAILED', error: err.message });
    throw err;
  }
};

export default {
  getKnowledgeSets,
  getKnowledgeSetById,
  createKnowledgeSet,
  updateKnowledgeSet,
  deleteKnowledgeSet,
  addItems,
  getItems,
  removeItem,
  getEffectiveDocumentIds,
  updateItemStatus,
  testRetrieval,
  syncItem,
};
