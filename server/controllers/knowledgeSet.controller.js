import asyncHandler from 'express-async-handler';
import knowledgeSetService from '../services/knowledgeSet.service.js';
import { sendSuccess } from '../utils/response.js';

/**
 * 知识集 Controller
 * 采用显式动作命名，仅使用 GET 和 POST，并使用统一响应工具
 */

// GET /get-list/:appId
export const getKnowledgeSets = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const list = await knowledgeSetService.getKnowledgeSets(appId);
  sendSuccess(res, list);
});

// GET /get/:id
export const getKnowledgeSet = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ks = await knowledgeSetService.getKnowledgeSetById(id);
  sendSuccess(res, ks);
});

// POST /create
export const createKnowledgeSet = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { name, description } = req.body;
  const userId = req.user._id.toString();
  const ks = await knowledgeSetService.createKnowledgeSet(appId, { name, description }, userId);
  sendSuccess(res, ks, 201);
});

// POST /update
export const updateKnowledgeSet = asyncHandler(async (req, res) => {
  const { id, name, description } = req.body;
  const userId = req.user._id.toString();
  const ks = await knowledgeSetService.updateKnowledgeSet(id, { name, description }, userId);
  sendSuccess(res, ks);
});

// POST /delete
export const deleteKnowledgeSet = asyncHandler(async (req, res) => {
  const { id } = req.body;
  await knowledgeSetService.deleteKnowledgeSet(id);
  sendSuccess(res, { message: 'Knowledge set deleted successfully' });
});

// --- 知识项管理 (Item Management) ---

// POST /add-items/:id
export const addItems = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resourceIds } = req.body;
  const userId = req.user._id.toString();
  const result = await knowledgeSetService.addItems(id, { resourceIds }, userId);
  sendSuccess(res, result);
});

// GET /get-items/:id
export const getItems = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await knowledgeSetService.getItems(id);
  sendSuccess(res, result);
});

// POST /remove-item/:id
export const removeItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resourceId } = req.body;
  const result = await knowledgeSetService.removeItem(id, { resourceId });
  sendSuccess(res, result);
});

// POST /test-retrieval/:id
export const testRetrieval = asyncHandler(async (req, res) => {
  const { appId, id } = req.params;
  const { query, limit } = req.body;
  const result = await knowledgeSetService.testRetrieval(appId, id, query, limit);
  sendSuccess(res, result);
});

// POST /sync-item/:id
export const syncItem = asyncHandler(async (req, res) => {
  const { appId, id } = req.params;
  const { resourceId } = req.body;
  const result = await knowledgeSetService.syncItem(appId, id, resourceId);
  sendSuccess(res, result);
});
