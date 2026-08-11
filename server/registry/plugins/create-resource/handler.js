import documentService from '../../../services/document.service.js';
import ResourceRepository from '../../../repositories/resource.repository.js';
import { markdownToBlocks } from '../../../utils/contentProcessor.js';
import { eq, sql } from 'drizzle-orm';

/**
 * Create Resource Plugin Handler
 * Refactored from resource.activity.js
 */
export async function handler(params, ctx) {
  const { 
    title, 
    content,
    parentId, 
    collisionStrategy = 'overwrite'
  } = params;

  const { appId, executorId: userId } = ctx;
  const targetTitle = title || '未命名文档';

  // 1. Check for existing resource with same name in same parent
  const conditions = [
    eq(ResourceRepository.table.appId, appId.toString()),
    eq(ResourceRepository.table.type, 'document'),
    eq(ResourceRepository.table.deleted, false),
    sql`${ResourceRepository.table.meta}->>'name' = ${targetTitle}`,
  ];

  if (parentId) {
    conditions.push(eq(ResourceRepository.table.parentId, parentId.toString()));
  } else {
    conditions.push(sql`${ResourceRepository.table.parentId} IS NULL`);
  }

  const existingResource = await ResourceRepository.findOne({
    where: (t, d) => d.and(...conditions),
  });

  // 2. Handle content: Auto-detect if it's Markdown string or Blocks array
  let finalBlocks = [];
  if (Array.isArray(content)) {
    finalBlocks = content;
  } else if (typeof content === 'string' && content.trim().length > 0) {
    finalBlocks = await markdownToBlocks(content);
  }

  if (existingResource) {
    if (collisionStrategy === 'overwrite') {
      await documentService.update(
        existingResource.refId,
        { title: targetTitle, blocks: finalBlocks },
        userId || 'system',
      );
      return { success: true, docId: existingResource.refId, action: 'overwrite' };
    } else if (collisionStrategy === 'skip') {
      return { success: true, docId: existingResource.refId, action: 'skip' };
    }
  }

  // 3. Default: Create new
  const doc = await documentService.createGeneralDoc(
    appId,
    {
      title: targetTitle,
      blocks: finalBlocks,
      parentId,
    },
    userId || 'system',
  );

  return { success: true, docId: doc.id, action: 'create' };
}
