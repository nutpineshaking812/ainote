import { logger } from '../../config/logger.js';
import { formRepository } from '../../repositories/form.repository.js';
import documentService from '../../services/document.service.js';
import { markdownToBlocks, blocksToMarkdown } from '../../utils/contentProcessor.js';
import ResourceRepository from '../../repositories/resource.repository.js';
import DocumentRepository from '../../repositories/document.repository.js';
import { eq, and, sql, gte, lte, inArray } from 'drizzle-orm';
import { string } from 'zod';

export const handleFetchResources = async (data, nodeId, workflowId) => {
  const { groups = [] } = data;
  logger.info(
    { nodeGroupsCount: groups.length },
    'Temporal Activity: Fetching resources with logical groups',
  );

  if (groups.length === 0) return { count: 0, resources: [] };

  const processGroup = async (group) => {
    const {
      type,
      appId,
      name,
      createdBy,
      createdAtStart,
      createdAtEnd,
      updatedAtStart,
      updatedAtEnd,
      parentId,
      includeChildren,
      includeParent,
      includeSelf,
    } = group;

    const resourceConditions = [eq(ResourceRepository.table.deleted, false)];
    const documentConditions = [];

    const appIdStr = appId ? appId.toString() : null;
    const parentIdStr = parentId ? parentId.toString() : null;

    if (appIdStr) resourceConditions.push(eq(ResourceRepository.table.appId, appIdStr));
    if (parentIdStr) resourceConditions.push(eq(ResourceRepository.table.parentId, parentIdStr));
    if (type && type !== 'all') resourceConditions.push(eq(ResourceRepository.table.type, type));

    const parseDate = (val) => {
      const d = new Date(val);
      return !isNaN(d.getTime()) ? d : null;
    };

    if (createdAtStart) {
      const d = parseDate(createdAtStart);
      if (d) documentConditions.push(gte(DocumentRepository.table.createdAt, d));
    }
    if (createdAtEnd) {
      const d = parseDate(createdAtEnd);
      if (d) documentConditions.push(lte(DocumentRepository.table.createdAt, d));
    }
    if (updatedAtStart) {
      const d = parseDate(updatedAtStart);
      if (d) documentConditions.push(gte(DocumentRepository.table.updatedAt, d));
    }
    if (updatedAtEnd) {
      const d = parseDate(updatedAtEnd);
      if (d) documentConditions.push(lte(DocumentRepository.table.updatedAt, d));
    }

    let initialMatches = [];
    const finalConditions = [...resourceConditions];
    if (documentConditions.length > 0) finalConditions.push(...documentConditions);

    if (name) {
      finalConditions.push(sql`${ResourceRepository.table.meta}->>'name' ILIKE ${`%${name}%`}`);
    }

    if (createdBy) {
      // Cross-entity creator filter (Doc createdBy is in PostgreSQL, Form owner is in MongoDB)
      const docIds = await DocumentRepository.findIdsByCreator(createdBy);

      const forms = await formRepository.findAll({
        where: (t, d) => d.eq(t.owner, createdBy.toString())
      });
      const formIds = forms.map((f) => f.id);

      const allIds = [...docIds, ...formIds];
      if (allIds.length > 0) finalConditions.push(inArray(ResourceRepository.table.refId, allIds));
      else return [];
    }

    initialMatches = await ResourceRepository.searchResources(finalConditions, 100);

    let resultSet = [];
    if (includeSelf !== false) resultSet.push(...initialMatches);

    // 3. Include Parent Document
    if (includeParent && parentIdStr && (!type || type === 'document' || type === 'all')) {
      const parentRes = await ResourceRepository.findById(parentIdStr);
      if (parentRes) {
        const doc = await DocumentRepository.findById(parentRes.refId);
        resultSet.push({ ...parentRes, document: doc });
      }
    }

    // 4. Include Children Documents (Flattening)
    if (includeChildren && initialMatches.length > 0) {
      const parentIds = initialMatches.map((m) => m.id);
      const descendants = await ResourceRepository.findDescendantsRecursive(parentIds);

      // Filter descendants if needed (e.g. only documents)
      let filteredDesc = descendants;
      if (type && type !== 'all') filteredDesc = descendants.filter((d) => d.type === type);

      // Batch fetch document details for descendants
      const docIds = filteredDesc.filter((d) => d.type === 'document').map((d) => d.refId);
      if (docIds.length > 0) {
        const docs = await DocumentRepository.findByIds(docIds);
        const docMap = new Map(docs.map((d) => [d.id, d]));
        resultSet.push(...filteredDesc.map((d) => ({ ...d, document: docMap.get(d.refId) })));
      } else {
        resultSet.push(...filteredDesc);
      }
    }

    return resultSet;
  };

  const allGroupResults = await Promise.all(groups.map((g) => processGroup(g)));
  const flatResults = allGroupResults.flat();

  // Deduplicate by resource id
  const seen = new Set();
  const uniqueResults = flatResults.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return {
    count: uniqueResults.length,
    resources: uniqueResults.map((r) => ({
      resourceId: r.id,
      type: r.type,
      refId: r.refId,
      name: r.meta?.name || r.document?.title || '未命名',
      content: r.document ? r.document.contentPlain : '',
      appId: r.appId,
      updatedAt: r.updatedAt,
    })),
  };
};

export const handleGetDocumentContent = async (docId) => {
  const doc = await DocumentRepository.findById(docId);
  if (!doc) throw new Error('Document not found');
  return { title: doc.title, content: doc.contentPlain, blocks: doc.blocks };
};

export const handleUpdateDocument = async (docId, content, title) => {
  const blocks = await markdownToBlocks(content);
  await documentService.update(docId, { title, blocks }, 'system');
  return { success: true };
};

export const readAppDocument = async ({ docId }) => {
  logger.info({ docId }, 'Temporal Activity: Reading document by docId');
  if (!docId) throw new Error('docId is required to read document');
  
  const doc = await DocumentRepository.findById(docId.toString());
  if (!doc) {
    throw new Error(`Document with ID "${docId}" not found`);
  }
  const content = await blocksToMarkdown(doc.blocks || [], { serverRuntime: true });
  return content || '';
};

export const getAppDocumentBlocks = async ({ docId, compilePrompt }) => {
  logger.info({ docId, compilePrompt }, 'Temporal Activity: Reading document blocks by docId');
  if (!docId) throw new Error('docId is required to read document');
  
  const doc = await DocumentRepository.findById(docId.toString());
  if (!doc) {
    throw new Error(`Document with ID "${docId}" not found`);
  }
  
  if (compilePrompt) {
    const { compileDocumentBlockPrompt } = await import('../../utils/documentPromptHelper.js');
    const promptText = await compileDocumentBlockPrompt(doc.blocks || []);
    return { title: doc.title, blocks: doc.blocks || [], prompt: promptText };
  }
  
  return { title: doc.title, blocks: doc.blocks || [] };
};


