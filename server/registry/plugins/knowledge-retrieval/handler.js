import MemoryService from '../../../services/memory/MemoryService.js';
import DocumentService from '../../../services/document.service.js';
import AIMemoryRepository from '../../../repositories/aiMemory.repository.js';
import { extractSectionByHeader } from '../../../utils/markdownUtils.js';
import { blocksToMarkdown } from '../../../utils/contentProcessor.js';

/**
 * Knowledge Retrieval Handler
 * Performs vector search and content extraction based on knowledgeSetIds.
 */
export async function handler(params, ctx) {
  const { query, limit = 5, minScore = 0.5, knowledgeSetIds } = params;

  let parsedKnowledgeSetIds = [];
  if (Array.isArray(knowledgeSetIds)) {
    parsedKnowledgeSetIds = knowledgeSetIds;
  } else if (typeof knowledgeSetIds === 'string' && knowledgeSetIds.trim().length > 0) {
    try {
      parsedKnowledgeSetIds = JSON.parse(knowledgeSetIds);
    } catch (e) {
      parsedKnowledgeSetIds = knowledgeSetIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const appId = ctx.triggerData?.appId || ctx.workflowData?.appId;
  const userId = ctx.triggerData?.triggeredBy;

  if (!query) throw new Error('Query is required for knowledge retrieval');

  let searchQuery = query;
  if (Array.isArray(query)) {
    const textItem = query.find((item) => item.type === 'text');
    searchQuery = textItem ? textItem.text : '';
  }

  const filter = {};
  if (parsedKnowledgeSetIds.length > 0) filter.knowledgeSetIds = parsedKnowledgeSetIds;

  const searchResults = await MemoryService.hybridSearch(appId, searchQuery, {
    limit,
    filter,
  });
  
  const filteredResults = searchResults
    .filter((r) => r.score >= minScore)
    .map((r) => ({
      sourceId: r.payload.memoryId || r.payload.docId,
      sourceType: r.payload.sourceType || 'document',
      sectionId: r.payload.sectionId,
      sectionHeader: r.payload.header,
      score: r.score,
      content: r.content,
    }));

  const contextParts = filteredResults
    .map((r) => r.content)
    .filter(Boolean);

  return {
    success: true,
    contextString: contextParts.join('\n\n---\n\n'),
    count: contextParts.length,
    results: filteredResults,
  };
}
