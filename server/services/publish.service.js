import PublishSettingRepository from '../repositories/publishSetting.repository.js';
import { formRepository } from '../repositories/form.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { hashAccessCode } from '../utils/publishUtils.js';
import crypto from 'crypto';

/**
 * Fetch publish settings or return defaults
 */
export const getPublishSettings = async (formId, appId) => {
  const settings = await PublishSettingRepository.findOne({
    where: (t, { eq, and }) => and(
      eq(t.formId, formId.toString()),
      eq(t.appId, appId.toString())
    )
  });
  return settings || { formId, appId };
};

/**
 * Helper to upsert settings
 */
const upsertSettings = async (appId, formId) => {
  const existing = await PublishSettingRepository.findOne({
    where: (t, { eq, and }) => and(
      eq(t.formId, formId.toString()),
      eq(t.appId, appId.toString())
    )
  });

  if (existing) return existing;

  return await PublishSettingRepository.create({
    formId: formId.toString(),
    appId: appId.toString(),
    createdAt: new Date(),
    updatedAt: new Date()
  });
};

/**
 * Update fill configuration
 */
export const updateFillConfig = async (appId, formId, patch) => {
  const settings = await upsertSettings(appId, formId);

  if (patch.useAccessCode === false) {
    patch.accessCodeHash = '';
    patch.accessCodePlain = '';
  } else if (patch.accessCode) {
    patch.accessCodeHash = hashAccessCode(patch.accessCode);
    patch.accessCodePlain = patch.accessCode;
    delete patch.accessCode;
  }

  if (patch.useLinkExpiry === false) patch.linkExpiresAt = null;

  const newFillLink = { ...(settings.fillLink || {}), ...patch };
  await PublishSettingRepository.update(settings.id, { 
    fillLink: newFillLink,
    updatedAt: new Date() 
  });
  return newFillLink;
};

/**
 * Update record share configuration
 */
export const updateRecordShareConfig = async (appId, formId, patch) => {
  const form = await formRepository.findOneByAppAndId(appId, formId);
  if (!form) throw ApiError.notFound('Form not found');

  if (patch.defaultFieldPermissions) {
    const fieldIds = (form.fields || []).map((f) => f.id);
    for (const key of Object.keys(patch.defaultFieldPermissions)) {
      if (!fieldIds.includes(key)) throw ApiError.badRequest('Field permissions mismatch');
      const perm = patch.defaultFieldPermissions[key];
      if (perm.editable && !perm.visible) throw ApiError.badRequest('Editable requires visible');
    }
  }

  const settings = await upsertSettings(appId, formId);
  const newRecordShare = { ...(settings.recordShare || {}), ...patch };
  await PublishSettingRepository.update(settings.id, { 
    recordShare: newRecordShare,
    updatedAt: new Date() 
  });
  return newRecordShare;
};

/**
 * Update query configuration
 */
export const updateQueryConfig = async (appId, formId, patch) => {
  const form = await formRepository.findOneByAppAndId(appId, formId);
  if (!form) throw ApiError.notFound('Form not found');

  const settings = await upsertSettings(appId, formId);

  if (patch.useAccessCode === false) {
    patch.accessCodeHash = '';
    patch.accessCodePlain = '';
  } else if (patch.accessCode) {
    patch.accessCodeHash = hashAccessCode(patch.accessCode);
    patch.accessCodePlain = patch.accessCode;
    delete patch.accessCode;
  }

  if (patch.useLinkExpiry === false) patch.linkExpiresAt = null;

  if (patch.fieldPermissions) {
    const fieldIds = (form.fields || []).map((f) => f.id);
    for (const key of Object.keys(patch.fieldPermissions)) {
      if (!fieldIds.includes(key)) throw ApiError.badRequest('Field permissions mismatch');
      patch.fieldPermissions[key].editable = false;
    }
  }

  const newQueryLink = { ...(settings.queryLink || {}), ...patch };
  await PublishSettingRepository.update(settings.id, { 
    queryLink: newQueryLink,
    updatedAt: new Date() 
  });
  return newQueryLink;
};

/**
 * Create external API token
 */
export const createExternalApiToken = async (appId, formId, tokenData) => {
  const { name, expiresAt, permissions } = tokenData;
  if (!name) throw ApiError.badRequest('Token name is required');

  const settings = await upsertSettings(appId, formId);
  const tokenString = 'fst_' + crypto.randomBytes(32).toString('hex');

  const newToken = {
    id: crypto.randomUUID(),
    name,
    token: tokenString,
    permissions: Array.isArray(permissions) ? permissions : ['WRITE'],
    expiresAt: expiresAt || null,
    createdAt: new Date(),
  };

  const newTokens = [...(settings.externalApi?.tokens || []), newToken];
  await PublishSettingRepository.update(settings.id, {
    externalApi: { ...(settings.externalApi || {}), tokens: newTokens },
    updatedAt: new Date()
  });
  return newToken;
};

/**
 * Update external API token
 */
export const updateExternalApiToken = async (appId, formId, tokenId, patch) => {
  const settings = await PublishSettingRepository.findOne({
    where: (t, { eq, and }) => and(
      eq(t.formId, formId.toString()),
      eq(t.appId, appId.toString())
    )
  });
  if (!settings) throw ApiError.notFound('Settings not found');

  const tokens = settings.externalApi?.tokens || [];
  const tokenIndex = tokens.findIndex(
    (t) => t.id === tokenId || (t._id && t._id.toString() === tokenId),
  );
  if (tokenIndex === -1) throw ApiError.notFound('Token not found');

  const token = tokens[tokenIndex];
  if (patch.name !== undefined) token.name = patch.name;
  if (patch.permissions !== undefined)
    token.permissions = Array.isArray(patch.permissions) ? patch.permissions : ['WRITE'];
  if (patch.expiresAt !== undefined) token.expiresAt = patch.expiresAt || null;

  await PublishSettingRepository.update(settings.id, {
    externalApi: { ...settings.externalApi, tokens },
    updatedAt: new Date()
  });
  return token;
};

/**
 * Delete external API token
 */
export const deleteExternalApiToken = async (appId, formId, tokenId) => {
  const settings = await PublishSettingRepository.findOne({
    where: (t, { eq, and }) => and(
      eq(t.formId, formId.toString()),
      eq(t.appId, appId.toString())
    )
  });
  if (!settings) throw ApiError.notFound('Settings not found');

  const tokens = (settings.externalApi?.tokens || []).filter(
    (t) => t.id !== tokenId && (!t._id || t._id.toString() !== tokenId),
  );

  await PublishSettingRepository.update(settings.id, {
    externalApi: { ...settings.externalApi, tokens },
    updatedAt: new Date()
  });
  return true;
};
