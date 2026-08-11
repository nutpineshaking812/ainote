import FileRepository from '../repositories/file.repository.js';
import env from '../config/env.js';
import qiniuProvider from './storageProviders/qiniu.provider.js';

const STORAGE_PROVIDER = env.STORAGE_PROVIDER || 'qiniu';

function pickProvider(name) {
  // Currently only supporting Qiniu as the primary provider
  return qiniuProvider;
}

/**
 * Get upload configuration/token for the client
 * @returns {Promise<Object>}
 */
async function getUploadConfig(mimeLimit = '') {
  const provider = pickProvider(STORAGE_PROVIDER);
  if (provider && provider.getUploadToken) {
    return provider.getUploadToken(mimeLimit);
  }
  return { provider: 'local' };
}

/**
 * Register a file that was uploaded directly by the client
 */
async function registerFile({ key, name, size, mime, provider, usageType, usageId }, userId) {
  // Use repository to create record in PostgreSQL
  const fileDoc = await FileRepository.create({
    name: name || key,
    provider: provider || STORAGE_PROVIDER,
    key,
    mime,
    size,
    createdBy: userId,
    status: 'available',
    usageType,
    usageId,
    meta: { source: 'direct-upload' }
  });
  
  return fileDoc;
}

/**
 * Get download URL for a file document
 */
async function getDownloadUrl(fileDoc) {
  if (!fileDoc) return null;
  const provider = pickProvider(fileDoc.provider);
  if (provider && provider.getDownloadUrl) return provider.getDownloadUrl(fileDoc);
  
  // Default to public download
  return `/api/v1/files/${fileDoc._id}/download`;
}

/**
 * Get private signed URL for a file document
 */
async function getPrivateDownloadUrl(fileDoc, expires = 3600) {
  if (!fileDoc) return null;
  const provider = pickProvider(fileDoc.provider);
  if (provider && provider.getPrivateDownloadUrl) return provider.getPrivateDownloadUrl(fileDoc, expires);
  return getDownloadUrl(fileDoc);
}

async function getById(id) {
  return FileRepository.findById(id);
}

async function incrementRefCount(fileId) {
  if (!fileId) return;
  const f = await FileRepository.findById(fileId);
  if (f) {
    await FileRepository.update(fileId, { refCount: f.refCount + 1 });
  }
}

async function decrementRefCount(fileId) {
  if (!fileId) return;
  const f = await FileRepository.findById(fileId);
  if (f && f.refCount > 0) {
    return FileRepository.update(fileId, { refCount: f.refCount - 1 });
  }
  return f;
}

async function deleteFileDoc(fileDoc) {
  if (!fileDoc) return false;
  const provider = pickProvider(fileDoc.provider);
  if (provider && provider.deleteFile) await provider.deleteFile(fileDoc);
  
  // Delete from PostgreSQL
  return FileRepository.delete(fileDoc._id);
}

export default {
  getUploadConfig,
  registerFile,
  getById,
  getDownloadUrl,
  getPrivateDownloadUrl,
  incrementRefCount,
  decrementRefCount,
  deleteFileDoc
};
