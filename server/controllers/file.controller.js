import asyncHandler from 'express-async-handler';
import fileService from '../services/file.service.js';
import markitdownService from '../services/markitdown.service.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

/**
 * File Metadata & Download
 */

export const getFileMeta = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const f = await fileService.getById(id);
  if (!f) throw ApiError.notFound('File not found');
  const downloadUrl = await fileService.getDownloadUrl(f);
  return sendSuccess(res, { file: f, downloadUrl });
});

export const downloadFile = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const f = await fileService.getById(id);
  if (!f) throw ApiError.notFound('File not found');

  const downloadUrl = await fileService.getDownloadUrl(f);
  if (!downloadUrl) throw ApiError.internal('No download URL available');
  
  return res.redirect(downloadUrl);
});

/**
 * Upload Configuration & Registration
 */

export const getUploadConfig = asyncHandler(async (req, res) => {
  const mimeLimit = req.query.mimeLimit || '';
  const config = await fileService.getUploadConfig(mimeLimit);
  return sendSuccess(res, config);
});

export const registerUploadedFile = asyncHandler(async (req, res) => {
  const { key, name, size, mime, provider, usageType, usageId } = req.body;
  if (!key) throw ApiError.badRequest('File key is required');

  const userId = req.user ? req.user.id : null;
  const fileDoc = await fileService.registerFile({ key, name, size, mime, provider, usageType, usageId }, userId);
  
  const downloadUrl = await fileService.getDownloadUrl(fileDoc);

  return sendSuccess(res, {
    ...fileDoc,
    url: downloadUrl
  });
});

/**
 * File Conversions
 */

export const convertMarkitdown = asyncHandler(async (req, res) => {
  const { fileId } = req.body;
  if (!fileId) throw ApiError.badRequest('fileId is required');

  const fileDoc = await fileService.getById(fileId);
  if (!fileDoc) throw ApiError.notFound('File record not found');

  const nodeId = req.body.nodeId || '';
  const result = await markitdownService.forwardToPythonService(fileDoc, nodeId);
  
  if (!result || !result.content) throw ApiError.internal('MarkItDown conversion failed');
  
  return sendSuccess(res, { 
    content: result.content, 
    format: result.format, 
    originalFile: { id: fileDoc._id } 
  });
});

export default {
  getFileMeta,
  downloadFile,
  getUploadConfig,
  registerUploadedFile,
  convertMarkitdown
};
