import crypto from 'crypto';

function generateAccessCode(length = 6) {
  // Exclude confusing characters 0 O I l
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    code += chars[idx];
  }
  return code;
}

function hashAccessCode(code) {
  if (!code) return '';
  return crypto.createHash('sha256').update(code).digest('hex');
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return Date.now() >= new Date(expiresAt).getTime();
}

function filterDataByPermissions(data, permissions) {
  if (!permissions || typeof permissions !== 'object' || Object.keys(permissions).length === 0) return data;
  const result = {};
  for (const [fieldId, perm] of Object.entries(permissions)) {
    if (perm && perm.visible && Object.prototype.hasOwnProperty.call(data, fieldId)) {
      result[fieldId] = data[fieldId];
    }
  }
  return result;
}

function assertEditableFields(updatePayload, permissions) {
  for (const key of Object.keys(updatePayload)) {
    const perm = permissions[key];
    if (!perm || !perm.visible || !perm.editable) {
      const err = new Error('Field not editable');
      err.statusCode = 403;
      throw err;
    }
  }
}

export {
  generateAccessCode,
  hashAccessCode,
  isExpired,
  filterDataByPermissions,
  assertEditableFields,
};
