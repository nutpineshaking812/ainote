import asyncHandler from 'express-async-handler';
import { sendSuccess } from '../utils/response.js';
import AIMemoryRepository from '../repositories/aiMemory.repository.js';
import { blocksToMarkdown } from '../utils/contentProcessor.js';

/**
 * @desc    List Agent's ai_memory records grouped by session
 * @route   GET /api/ai/agent-memory/:appId/list
 * @access  Private
 */
export const getAgentMemoryList = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const mems = await AIMemoryRepository.listAgentMemories(appId);

  const sessions = mems.map((m) => ({
    _id: m.id,
    docId: m.id,
    sessionId: m.sessionId || null,
    title: m.title || '智能体长期记忆',
    updatedAt: m.updatedAt,
  }));

  return sendSuccess(res, sessions);
});

/**
 * @desc    Get Agent's ai_memory markdown content
 * @route   GET /api/ai/agent-memory/:appId/:docId
 * @access  Private
 */
export const getAgentMemoryContent = asyncHandler(async (req, res) => {
  const { docId } = req.params;
  const mem = await AIMemoryRepository.findById(docId);

  if (!mem || mem.category !== 'AGENT_MEMORY') {
    res.status(404);
    throw new Error('Agent memory not found');
  }

  const content = mem.content
    || (mem.blocks?.length
      ? await blocksToMarkdown(mem.blocks, { serverRuntime: true, withImage: false })
      : '');

  return sendSuccess(res, {
    _id: mem.id,
    docId: mem.id,
    sessionId: mem.sessionId || null,
    title: mem.title || '智能体长期记忆',
    content,
    updatedAt: mem.updatedAt,
  });
});
