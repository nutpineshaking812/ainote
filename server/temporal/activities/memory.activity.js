import AIMemoryRepository from '../../repositories/aiMemory.repository.js';
import { db } from '../../db/index.js';
import { aiMemories } from '../../db/schema/index.js';
import { eq, and, sql, desc, inArray, isNull, gte } from 'drizzle-orm';
import {
  extractSectionByHeader,
  updateSectionInMarkdown,
  splitMarkdownBySections,
} from '../../utils/markdownUtils.js';
import { blocksToMarkdown, markdownToBlocks } from '../../utils/contentProcessor.js';
import MemoryService from '../../services/memory/MemoryService.js';
import DocumentService from '../../services/document.service.js';
import { WorkflowExecutionRepository } from '../../repositories/workflowExecution.repository.js';

// --- Vector Search Activities ---

/**
 * node: vectorIndex
 */
export async function vectorIndex(params) {
  const { documentId, appId, userId, sessionId, sessionName } = params;
  if (!documentId) throw new Error('documentId is required for vectorIndex');

  const doc = await DocumentService.getSingle(documentId, userId);
  if (!doc) throw new Error(`Document not found: ${documentId}`);

  const result = await MemoryService.indexDocument(doc, {
    sessionId,
    sessionName,
  });
  return { success: true, ...result };
}

/**
 * node: vectorSearch
 */
export async function vectorSearch(params) {
  let { appId, query, limit = 5, minScore = 0.5, sessionId } = params;

  if (appId === 'null' || appId === 'undefined') appId = null;

  if (!query) {
    throw new Error('query is required for vectorSearch');
  }

  const filter = {};
  if (sessionId) filter.sessionId = sessionId;
  if (params.userId) filter.userId = params.userId.toString();

  const results = await MemoryService.search(appId, query, { limit, filter });

  const filtered = results
    .filter((r) => r.score >= minScore)
    .map((r) => ({
      sourceId: r.payload.memoryId || r.payload.docId,
      sourceType: r.payload.sourceType || 'document',
      sectionId: r.payload.sectionId,
      sectionHeader: r.payload.header,
      score: r.score,
    }));

  return { results: filtered, count: filtered.length };
}

/**
 * node: fetchMemorySection
 */
export async function fetchMemorySection(params) {
  const { results = [], userId } = params;
  if (results.length === 0) return { contextString: '' };

  let contextParts = [];

  for (const item of results) {
    const { sourceId, sourceType, sectionHeader } = item;
    let blocks = [];
    let title = 'Unknown';

    if (sourceType === 'memory') {
      const memory = await AIMemoryRepository.findById(sourceId);
      if (!memory) continue;
      blocks = memory.blocks;
      title = memory.title;
    } else {
      const doc = await DocumentService.getSingle(sourceId, userId);
      if (!doc) continue;
      blocks = doc.blocks;
      title = doc.title;
    }

    const markdown = await blocksToMarkdown(blocks);
    const options = { defaultRoot: '' };
    let content = extractSectionByHeader(markdown, sectionHeader, options);

    if (!content && sourceType === 'memory' && sectionHeader.includes(' > ')) {
      const leafHeader = sectionHeader.split(' > ').pop();
      content = extractSectionByHeader(markdown, leafHeader, options);
    }

    if (content) {
      contextParts.push(`### Source: ${title} > ${sectionHeader}\n${content}`);
    }
  }

  return {
    contextString: contextParts.join('\n\n---\n\n'),
    count: contextParts.length,
  };
}

/**
 * node: getMemoryHeaders
 */
export async function getMemoryHeaders(params) {
  const { appId, sessionId, categories = ['FACT', 'SOP', 'DECISION'] } = params;
  if (!appId) return { categories: {} };

  const memories = await db
    .select()
    .from(aiMemories)
    .where(
      and(
        eq(aiMemories.appId, appId.toString()),
        inArray(aiMemories.category, categories),
        inArray(aiMemories.sessionId, [sessionId])
      )
    );

  const result = {};

  for (const cat of categories) {
    const catMemories = memories.filter((m) => m.category === cat);
    const headers = new Set();

    for (const mem of catMemories) {
      if (!mem.content) continue;
      const sections = splitMarkdownBySections(mem.content, { defaultRoot: mem.title });
      sections.forEach((s) => {
        const subPath = s.path.slice(1).join(' > ');
        if (subPath) headers.add(subPath);
      });
    }
    result[cat] = [...headers];
  }

  return { categories: result };
}

/**
 * node: upsertMemorySection
 */
export async function upsertMemorySection(params) {
  let {
    appId,
    sectionHeader,
    content,
    title: passedTitle,
    userId,
    sessionId,
    sessionName,
    category = 'FACT',
  } = params;

  if (!appId || appId === 'null' || appId === 'undefined') appId = null;
  if (!sessionId || sessionId === 'null' || sessionId === 'undefined') sessionId = null;

  const isSnapshot = category === 'SNAPSHOT';
  let title = passedTitle || category;
  let sectionAnchor = sectionHeader || 'Summary';

  if (isSnapshot) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    sectionAnchor = `[${timeStr}] ${sectionAnchor}`;
  }

  if (Array.isArray(content)) {
    content = content
      .map((item) => {
        const trimmed = String(item).trim();
        if (!trimmed) return '';
        return trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)
          ? trimmed
          : `- ${trimmed}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  const options = { defaultRoot: '', append: isSnapshot };

  const filters = [eq(aiMemories.title, title)];
  if (appId) filters.push(eq(aiMemories.appId, appId.toString())); else filters.push(isNull(aiMemories.appId));
  if (sessionId) filters.push(eq(aiMemories.sessionId, sessionId)); else filters.push(isNull(aiMemories.sessionId));

  const [memory] = await db.select().from(aiMemories).where(and(...filters));

  let finalContent = content;
  if (memory && memory.content) {
    finalContent = updateSectionInMarkdown(memory.content, sectionAnchor, content, options);
  } else {
    finalContent = `## ${sectionAnchor}\n${content}`;
  }

  const finalBlocks = await markdownToBlocks(finalContent);

  const data = {
    appId: appId?.toString(),
    title,
    sessionId,
    sessionName,
    userId: userId?.toString(),
    blocks: finalBlocks,
    content: finalContent,
    category,
    version: sql`${aiMemories.version} + 1`,
  };

  let upserted;
  if (memory) {
    [upserted] = await db.update(aiMemories).set(data).where(eq(aiMemories.id, memory.id)).returning();
  } else {
    upserted = await AIMemoryRepository.create({ ...data, version: 1 });
  }

  try {
    await MemoryService.indexMemoryCard(upserted);
  } catch (indexErr) {
    console.error(`[MemoryActivity] Indexing failed:`, indexErr);
  }

  return { success: true, memoryId: upserted.id, title: upserted.title };
}

/**
 * node: getExecutionLogs
 */
export async function getExecutionLogs(params) {
  const { appId, limit = 5, status = 'SUCCESS', sessionId } = params;

  const { executions } = await WorkflowExecutionRepository.find({
    status,
    appId,
    sessionId
  }, { limit });

  const simplifiedLogs = executions.map((ex) => ({
    executionId: ex.id,
    workflowId: ex.workflowId,
    timestamp: ex.createdAt,
    results: ex.nodeResults,
  }));

  return { logs: simplifiedLogs, count: simplifiedLogs.length };
}

/**
 * node: fetchRecentSnapshots
 */
export async function fetchRecentSnapshots(params) {
  let { appId, days = 7, sessionId, deleteAfterFetch = false } = params;

  if (appId === 'null' || appId === 'undefined') appId = null;
  if (sessionId === 'null' || sessionId === 'undefined') sessionId = null;

  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - days);

  const filters = [eq(aiMemories.category, 'SNAPSHOT'), gte(aiMemories.updatedAt, dateLimit)];

  if (appId) filters.push(eq(aiMemories.appId, appId.toString())); else filters.push(isNull(aiMemories.appId));
  if (sessionId) filters.push(eq(aiMemories.sessionId, sessionId)); else filters.push(isNull(aiMemories.sessionId));

  const memories = await db.select().from(aiMemories).where(and(...filters)).orderBy(desc(aiMemories.updatedAt));

  let combinedContent = '';
  for (const m of memories) {
    const text = m.content || (m.blocks?.length ? await blocksToMarkdown(m.blocks) : '');
    combinedContent += `### [${m.title}]\n${text}\n\n`;
  }

  if (memories.length > 0 && deleteAfterFetch) {
    const memoryIds = memories.map((m) => m.id);
    await db.delete(aiMemories).where(inArray(aiMemories.id, memoryIds));

    for (const mId of memoryIds) {
      try {
        await MemoryService.unindexMemoryCard(mId);
      } catch (err) {
        console.warn(`[MemoryActivity] failed to unindex old snapshot ${mId}`, err);
      }
    }
  }

  return { content: combinedContent, count: memories.length };
}
