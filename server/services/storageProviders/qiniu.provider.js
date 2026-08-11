import qiniu from 'qiniu';
import env from '../../config/env.js';
import path from 'path';

const accessKey = env.QINIU_ACCESS_KEY;
const secretKey = env.QINIU_SECRET_KEY;
const bucket = env.QINIU_BUCKET;
const domain = env.QINIU_DOMAIN;

const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
const config = new qiniu.conf.Config();

/**
 * Get a public URL for the file.
 */
export async function getDownloadUrl(fileDoc) {
  const formattedDomain = domain.startsWith('https') ? domain : `https://${domain}`;
  const bucketManager = new qiniu.rs.BucketManager(mac, config);
  return bucketManager.publicDownloadUrl(formattedDomain, fileDoc.key);
}

/**
 * Get a private/signed URL for the file.
 */
export async function getPrivateDownloadUrl(fileDoc, expires = 3600) {
  const formattedDomain = domain.startsWith('http') ? domain : `http://${domain}`;
  const bucketManager = new qiniu.rs.BucketManager(mac, config);
  const deadline = parseInt(Date.now() / 1000) + expires;
  return bucketManager.privateDownloadUrl(formattedDomain, fileDoc.key, deadline);
}

/**
 * Delete a file from Qiniu OSS.
 */
export async function deleteFile(fileDoc) {
  return new Promise((resolve, reject) => {
    const bucketManager = new qiniu.rs.BucketManager(mac, config);
    bucketManager.delete(bucket, fileDoc.key, (err, respBody, respInfo) => {
      if (err) return reject(err);
      if (respInfo.statusCode === 200) resolve(true);
      else reject(new Error(`Qiniu delete failed with status ${respInfo.statusCode}`));
    });
  });
}

/**
 * Generate an upload token for client-side direct upload to Qiniu.
 * Implements prefix-based scope for token reuse.
 * @param {string} [mimeLimit] - Optional mime type limit (e.g. 'image/*')
 * @returns {Object} { token, prefix, domain, provider: 'qiniu', expires: 3600 }
 */
export async function getUploadToken(mimeLimit = '') {
  // Use a fixed prefix for this environment/app
  const prefix = `mars/`;

  // Maximum file size from environment (default 20MB)
  const fsizeLimit = (env.MAX_ATTACHMENT_FILE_SIZE_MB || 20) * 1024 * 1024;

  const options = {
    scope: `${bucket}:${prefix}`,
    isPrefixalScope: 1,
    expires: 3600, // 1 hour
    insertOnly: 1, // Prevent overwriting
    fsizeLimit: fsizeLimit,
    detectMime: 1,
    returnBody: JSON.stringify({
      key: '$(key)',
      name: '$(fname)',
      size: '$(fsize)',
      mime: '$(mimeType)',
      hash: '$(etag)',
    }),
  };

  if (mimeLimit) {
    options.mimeLimit = mimeLimit;
  }

  const putPolicy = new qiniu.rs.PutPolicy(options);
  const uploadToken = putPolicy.uploadToken(mac);
  const formattedDomain = domain.startsWith('https') ? domain : `https://${domain}`;

  return {
    token: uploadToken,
    prefix: prefix,
    domain: formattedDomain,
    provider: 'qiniu',
    expires: 3600,
  };
}

export default {
  getDownloadUrl,
  getPrivateDownloadUrl,
  deleteFile,
  getUploadToken,
};
