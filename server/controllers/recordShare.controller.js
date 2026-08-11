import asyncHandler from 'express-async-handler';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import RecordShareMetaRepository from '../repositories/recordShareMeta.repository.js';
import PublishSettingRepository from '../repositories/publishSetting.repository.js';
import { formRecordRepository } from '../repositories/formRecord.repository.js';
import {
  generateAccessCode,
  hashAccessCode,
  filterDataByPermissions,
  assertEditableFields,
  isExpired,
} from '../utils/publishUtils.js';

// List record shares
export const listRecordShares = asyncHandler(async (req, res) => {
  const { appId, formId } = req.params;
  const { page = 1, limit = 10, status } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = (t, { eq, and }) => {
    const conditions = [eq(t.formId, formId.toString())];
    if (status) conditions.push(eq(t.status, status));
    return and(...conditions);
  };

  const items = await RecordShareMetaRepository.find({
    where,
    limit: parseInt(limit),
    offset: skip,
  });
  const total = await RecordShareMetaRepository.count({ where });

  return sendSuccess(res, {
    shares: items,
    pagination: {
      currentPage: parseInt(page),
      totalRecords: total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// Create or update a share for a record
export const shareRecord = asyncHandler(async (req, res) => {
  const { appId, formId, recordId } = req.params;
  const settings = await PublishSettingRepository.findByFormId(formId);
  if (!settings || !settings.recordShare.isPublic)
    throw ApiError.forbidden('Record share feature disabled', 'RECORD_SHARE_DISABLED');
  const record = await formRecordRepository.findOneByFormAndId(formId, recordId);
  if (!record) throw ApiError.notFound('Record not found', 'RECORD_NOT_FOUND');

  const body = req.body || {};
  let meta = await RecordShareMetaRepository.findByRecordId(recordId);
  if (!meta) {
    const perms = body.fieldPermissions || settings.recordShare.defaultFieldPermissions || {};
    // Validate perms
    for (const [k, v] of Object.entries(perms)) {
      if (v.editable && !v.visible)
        throw ApiError.badRequest('Editable requires visible', 'FIELD_PERMS_INVALID');
    }
    let expiresAt = null;
    if (body.useExpiry) {
      expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    } else if (settings.recordShare.defaultExpiryHours) {
      expiresAt = new Date(Date.now() + settings.recordShare.defaultExpiryHours * 3600000);
    }
    let accessCodePlain = null;
    if (body.useAccessCode) {
      accessCodePlain = body.accessCode || generateAccessCode();
    }
    meta = await RecordShareMetaRepository.create({
      recordId: recordId.toString(),
      formId: formId.toString(),
      appId: appId.toString(),
      fieldPermissions: perms,
      useAccessCode: !!body.useAccessCode,
      accessCodeHash: body.useAccessCode ? hashAccessCode(accessCodePlain) : '',
      useExpiry: expiresAt != null,
      expiresAt: expiresAt,
      createdBy: req.user.id.toString(),
    });
    return sendSuccess(res, { share: meta, accessCode: accessCodePlain }, 201);
  } else {
    // Update existing meta
    const updateData = {};
    if (body.fieldPermissions) {
      for (const [k, v] of Object.entries(body.fieldPermissions)) {
        if (v.editable && !v.visible)
          throw ApiError.badRequest('Editable requires visible', 'FIELD_PERMS_INVALID');
      }
      updateData.fieldPermissions = body.fieldPermissions;
    }
    if (typeof body.useAccessCode === 'boolean') {
      updateData.useAccessCode = body.useAccessCode;
      if (!body.useAccessCode) {
        updateData.accessCodeHash = '';
      } else if (body.accessCode) {
        updateData.accessCodeHash = hashAccessCode(body.accessCode);
      }
    }
    if (typeof body.useExpiry === 'boolean') {
      updateData.useExpiry = body.useExpiry;
      if (!body.useExpiry) updateData.expiresAt = null;
      else if (body.expiresAt) updateData.expiresAt = new Date(body.expiresAt);
    }
    
    if (Object.keys(updateData).length > 0) {
      meta = await RecordShareMetaRepository.update(meta.id, updateData);
    }
    return sendSuccess(res, { share: meta });
  }
});

// Rotate access code
export const rotateShareCode = asyncHandler(async (req, res) => {
  const { appId, formId, recordId } = req.params;
  const meta = await RecordShareMetaRepository.findOne({
    where: (t, { eq, and }) => and(
      eq(t.recordId, recordId.toString()),
      eq(t.formId, formId.toString()),
      eq(t.appId, appId.toString())
    )
  });
  if (!meta) throw ApiError.notFound('Record share not found', 'RECORD_SHARE_NOT_FOUND');
  if (!meta.useAccessCode)
    throw ApiError.badRequest('Access code not enabled', 'ACCESS_CODE_DISABLED');
  if (meta.status !== 'active')
    throw ApiError.badRequest('Cannot rotate non-active share', 'RECORD_SHARE_INACTIVE');
  
  const newCode = generateAccessCode();
  const updated = await RecordShareMetaRepository.update(meta.id, {
    accessCodeHash: hashAccessCode(newCode),
    rotatedAt: new Date()
  });
  return sendSuccess(res, { share: updated, accessCode: newCode });
});

// Revoke share
export const revokeShare = asyncHandler(async (req, res) => {
  const { appId, formId, recordId } = req.params;
  const meta = await RecordShareMetaRepository.findOne({
    where: (t, { eq, and }) => and(
      eq(t.recordId, recordId.toString()),
      eq(t.formId, formId.toString()),
      eq(t.appId, appId.toString())
    )
  });
  if (!meta) throw ApiError.notFound('Record share not found', 'RECORD_SHARE_NOT_FOUND');
  const updated = await RecordShareMetaRepository.update(meta.id, { status: 'revoked' });
  return sendSuccess(res, { share: updated });
});

// Extend expiry
export const extendShareExpiry = asyncHandler(async (req, res) => {
  const { appId, formId, recordId } = req.params;
  const { additionalHours = 24 } = req.body;
  const meta = await RecordShareMetaRepository.findOne({
    where: (t, { eq, and }) => and(
      eq(t.recordId, recordId.toString()),
      eq(t.formId, formId.toString()),
      eq(t.appId, appId.toString())
    )
  });
  if (!meta) throw ApiError.notFound('Record share not found', 'RECORD_SHARE_NOT_FOUND');
  if (!meta.useExpiry) throw ApiError.badRequest('Expiry not enabled', 'EXPIRY_DISABLED');
  const base = meta.expiresAt ? new Date(meta.expiresAt).getTime() : Date.now();
  const updated = await RecordShareMetaRepository.update(meta.id, {
    expiresAt: new Date(base + additionalHours * 3600000)
  });
  return sendSuccess(res, { share: updated });
});

// Public get record via share
export const publicGetSharedRecord = asyncHandler(async (req, res) => {
  const { formId, recordId } = req.params;
  const record = await formRecordRepository.findOneByFormAndId(formId, recordId);
  if (!record) throw ApiError.notFound('Record not found', 'RECORD_NOT_FOUND');
  
  const meta = await RecordShareMetaRepository.findOne({
    where: (t, { eq, and }) => and(
      eq(t.recordId, recordId.toString()),
      eq(t.formId, formId.toString())
    )
  });
  if (!meta) throw ApiError.notFound('Record share not found', 'RECORD_SHARE_NOT_FOUND');
  if (meta.status !== 'active')
    throw ApiError.forbidden('Record share revoked', 'RECORD_SHARE_REVOKED');
  if (meta.useExpiry && isExpired(meta.expiresAt))
    throw ApiError.forbidden('Link expired', 'LINK_EXPIRED');
  if (meta.useAccessCode) {
    const provided = (req.query.accessCode || req.body.accessCode || '').trim();
    if (!provided) throw ApiError.forbidden('Access code required', 'ACCESS_CODE_REQUIRED');
    if (hashAccessCode(provided) !== meta.accessCodeHash)
      throw ApiError.forbidden('Invalid access code', 'ACCESS_CODE_INVALID');
  }
  const filtered = filterDataByPermissions(record.data, meta.fieldPermissions);
  return sendSuccess(res, {
    _id: record.id,
    form: record.formId,
    app: record.appId,
    data: filtered,
    fieldPermissions: meta.fieldPermissions,
    createdAt: record.createdAt,
  });
});

// Public update shared record
export const publicUpdateSharedRecord = asyncHandler(async (req, res) => {
  const { formId, recordId } = req.params;
  const meta = await RecordShareMetaRepository.findOne({
    where: (t, { eq, and }) => and(
      eq(t.recordId, recordId.toString()),
      eq(t.formId, formId.toString())
    )
  });
  if (!meta) throw ApiError.notFound('Record share not found', 'RECORD_SHARE_NOT_FOUND');
  if (meta.status !== 'active')
    throw ApiError.forbidden('Record share revoked', 'RECORD_SHARE_REVOKED');
  if (meta.useExpiry && isExpired(meta.expiresAt))
    throw ApiError.forbidden('Link expired', 'LINK_EXPIRED');
  if (meta.useAccessCode) {
    const provided = (req.query.accessCode || req.body.accessCode || '').trim();
    if (!provided) throw ApiError.forbidden('Access code required', 'ACCESS_CODE_REQUIRED');
    if (hashAccessCode(provided) !== meta.accessCodeHash)
      throw ApiError.forbidden('Invalid access code', 'ACCESS_CODE_INVALID');
  }
  const updates = req.body.data || {};
  try {
    assertEditableFields(updates, meta.fieldPermissions);
  } catch (e) {
    throw ApiError.forbidden(e.message, 'FIELD_EDIT_FORBIDDEN');
  }
  const record = await formRecordRepository.findOneByFormAndId(formId, recordId);
  if (!record) throw ApiError.notFound('Record not found', 'RECORD_NOT_FOUND');
  const updatedData = { ...record.data, ...updates };
  const updated = await formRecordRepository.update(recordId, { data: updatedData });
  const filtered = filterDataByPermissions(updated.data, meta.fieldPermissions);
  return sendSuccess(res, { _id: updated.id, data: filtered, updatedAt: updated.updatedAt });
});
