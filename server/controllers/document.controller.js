// External dependencies
import asyncHandler from 'express-async-handler';

// Internal utilities & models
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import documentService from '../services/document.service.js';
import resourceService from '../services/resource.service.js';
import dashboardService from '../services/dashboard.service.js';

/**
 * POST /api/v1/documents
 * Dispatch creation of a document based on purpose or provided IDs.
 * @returns {Document}
 */
export const createDocument = asyncHandler(async (req, res) => {
  // Merge appId from URL params into body (URL params take precedence)
  const bodyWithAppId = { ...req.body, appId: req.params.appId || req.body.appId };
  const doc = await documentService.dispatchCreate(bodyWithAppId, req.user.id);
  return sendSuccess(res, doc, 201);
});

/**
 * GET /api/v1/documents/:docId
 * Fetch a single document; enforce context-based ownership.
 */
export const getDocument = asyncHandler(async (req, res) => {
  const doc = await documentService.getSingle(req.params.docId, req.user.id);
  return sendSuccess(res, doc);
});

/**
 * PUT /api/v1/documents/:docId
 * Update mutable fields of a document; rebuild plain text when raw changes.
 */
export const updateDocument = asyncHandler(async (req, res) => {
  const doc = await documentService.update(req.params.docId, req.body, req.user.id);
  return sendSuccess(res, doc);
});

/**
 * GET list (multi-mode)
 * If parentId provided: list children (or root when parentId === 'root').
 * Else if appId+formId provided: list record-level docs for that form.
 * WHY: consolidates several legacy listing behaviors into one endpoint.
 */
export const listDocuments = asyncHandler(async (req, res) => {
  // 统一字段投影（不查询 blocks/contentPlain/attachments）
  const result = await documentService.list(req.query, req.params, req.user.id);
  return sendSuccess(res, result);
});

/**
 * DELETE /api/v1/documents/:docId
 * Safely delete a document ensuring no children and clearing ownership references.
 */
export const deleteDocument = asyncHandler(async (req, res) => {
  const { appId, docId } = req.params;
  const result = await documentService.remove(docId, req.user.id, appId);
  return sendSuccess(res, result);
});

/**
 * GET /api/v1/documents/recent?limit=6
 * Return user-relevant recent documents (created or linked via owned records).
 */
export const recentDocuments = asyncHandler(async (req, res) => {
  const { limit, lastId, q } = req.query || {};
  const docs = await documentService.recent(req.user.id, req.organization._id, limit, lastId, q);
  return sendSuccess(res, docs);
});

// GET /api/v1/documents/:docId/with-children
// 返回单个文档及其所有直接子文档（子项仅返回 _id 与 title）
export const getDocumentWithChildren = asyncHandler(async (req, res) => {
  const combined = await documentService.getWithChildren(req.params.docId, req.user.id);
  return sendSuccess(res, combined);
});

// GET /api/v1/documents/:docId/path
// 返回从根到目标文档的层级链 { id, title }[]
export const getDocumentPath = asyncHandler(async (req, res) => {
  const tree = await resourceService.getPath(req.params.docId, req.user.id);
  // return nested tree for client to consume
  return sendSuccess(res, { tree });
});

/**
 * POST /api/v1/documents/:docId/share
 * Update document sharing settings.
 * Body: { shares: [...] }
 */
export const shareDocument = asyncHandler(async (req, res) => {
  const { shares } = req.body;
  if (!Array.isArray(shares)) {
    throw ApiError.badRequest('Shares must be an array', 'INVALID_SHARES_FORMAT');
  }
  const doc = await documentService.shareDocument(req.params.docId, shares, req.user.id);
  return sendSuccess(res, doc);
});
