import api from './index';
import axios from 'axios';

// Simple in-memory cache for upload tokens
const tokenCache = {
  data: null,
  expiry: 0
};

/**
 * Fetch upload configuration from backend with caching
 */
const getCachedUploadConfig = async (mimeLimit = '') => {
  const now = Date.now();
  // If we have a valid token that hasn't expired (with 5 min buffer)
  if (tokenCache.data && tokenCache.expiry > now + 300000) {
    return tokenCache.data;
  }

  const resp = await api.get('/files/get-config', { params: { mimeLimit } });
  const config = resp; // api interceptor returns resp.data

  // Cache it
  tokenCache.data = config;
  tokenCache.expiry = now + (config.expires || 3600) * 1000;

  return config;
};

/**
 * Upload a file directly to Qiniu OSS
 */
const uploadToQiniu = async (file, config, onProgress) => {
  const { token, prefix, domain } = config;
  
  // Generate a unique key using prefix + timestamp + random
  const ext = file.name.split('.').pop();
  const randomStr = Math.random().toString(36).substring(2, 10);
  const key = `${prefix}${Date.now()}-${randomStr}.${ext}`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('token', token);
  formData.append('key', key);

  // Qiniu upload endpoint (can be customized by region, default to upload.qiniup.com)
  const uploadUrl = 'https://upload.qiniup.com';

  const resp = await axios.post(uploadUrl, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    }
  });

  // Qiniu returns returnBody if defined, or default { key, hash }
  // Our backend defined returnBody to include name, size, mime, etc.
  return {
    ...resp.data,
    url: `${domain}/${resp.data.key}`,
    provider: 'qiniu'
  };
};

/**
 * Register the uploaded file metadata in our backend
 */
const registerFile = async (fileData) => {
  return await api.post('/files/register', fileData);
};

/**
 * Unified Upload Flow: Get Config -> Upload to OSS -> Register in DB
 */
export const uploadImage = async (file, opts = {}) => {
  const { onProgress, mimeLimit = 'image/*', usageType, usageId } = opts;
  
  try {
    // 1. Get upload config (token, prefix, etc.)
    const config = await getCachedUploadConfig(mimeLimit);
    
    // 2. Upload directly to Qiniu
    const qiniuData = await uploadToQiniu(file, config, onProgress);
    
    // 3. Register file in our database
    const fileDoc = await registerFile({
      key: qiniuData.key,
      name: file.name,
      size: parseInt(qiniuData.size),
      mime: qiniuData.mime,
      provider: 'qiniu',
      usageType,
      usageId
    });
    
    // Return a combined object compatible with existing code
    return {
      ...fileDoc,
      url: qiniuData.url // Ensure URL is present for immediate UI update
    };
  } catch (error) {
    console.error('Upload flow failed:', error);
    // If it's a token error, clear cache
    if (error.response?.status === 401 || error.response?.status === 403) {
      tokenCache.data = null;
    }
    throw error;
  }
};

/**
 * Sequential multiple upload
 */
export const uploadImages = async (files, opts = {}) => {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const info = await uploadImage(files[i], {
      ...opts,
      onProgress: (p) => opts.onFileProgress && opts.onFileProgress(i, p),
    });
    results.push(info);
  }
  return results;
};

/**
 * Generic attachment upload (same flow, different mimeLimit)
 */
export const uploadAttachment = async (file, opts = {}) => {
  return uploadImage(file, { ...opts, mimeLimit: '' });
};

export const uploadAttachments = async (files, opts = {}) => {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const info = await uploadAttachment(files[i], {
      onProgress: (p) => opts.onFileProgress && opts.onFileProgress(i, p),
    });
    results.push(info);
  }
  return results;
};

// Placeholder for markitdown which might need different handling
export const markitdownUpload = async (file, nodeId, opts = {}) => {
  // 1. Upload the file first
  const fileInfo = await uploadAttachment(file, opts);
  
  // 2. Call conversion endpoint with the registered file ID
  const resp = await api.post('/files/convert-markitdown', { 
    fileId: fileInfo.id,
    nodeId 
  });
  return resp; // { markdown, originalPath, markdownPath }
};
