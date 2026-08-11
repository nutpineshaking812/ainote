import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import env from '../config/env.js';
import fileService from './file.service.js';

/**
 * Forward file to Python MarkItDown service and return conversion result
 * @param {Object} fileDoc - Database file document
 * @param {string} nodeId
 * @returns {Promise<{content: string, format: string}>}
 */
async function forwardToPythonService(fileDoc, nodeId) {
  // 1. 获取文件的公共下载 URL
  const downloadUrl = await fileService.getDownloadUrl(fileDoc);

  const pythonUrl = env.MARKITDOWN_SERVICE_URL;

  try {
    // 2. 直接发送 URL 给 Python 服务，不再进行繁重的文件中转
    const response = await axios.post(
      pythonUrl,
      {
        fileUrl: downloadUrl,
        filename: fileDoc.name,
        nodeId: nodeId || '',
      },
      {
        timeout: 120000, // 2 minutes timeout for conversion
      },
    );

    const data = response.data || {};
    if (!data.content) {
      throw new Error('Conversion result missing content');
    }
    return {
      content: data.content,
      format: data.format,
      originalPath: data.originalPath,
      markdownPath: data.markdownPath,
    };
  } catch (error) {
    console.error('Error forwarding to MarkItDown service:', error);
    throw error;
  }
}

export default {
  forwardToPythonService,
};
