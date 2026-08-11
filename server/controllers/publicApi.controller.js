import asyncHandler from 'express-async-handler';
import PublishSettingRepository from '../repositories/publishSetting.repository.js';
import { formRepository } from '../repositories/form.repository.js';
import { formRecordRepository } from '../repositories/formRecord.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

/**
 * Public submission of a form using a Form-Level Token.
 * Route: POST /api/v1/public/forms/:formId/external/submit
 */
export const publicExternalSubmit = asyncHandler(async (req, res) => {
  let { formId } = req.params;
  const token = req.headers['x-form-token'];

  if (!token) {
    throw ApiError.unauthorized('X-Form-Token header is missing', 'TOKEN_MISSING');
  }

  // 1. Find settings (prefer formId from params, fallback to token-based lookup)
  let settings;
  if (formId) {
    settings = await PublishSettingRepository.findByFormId(formId);
  } else {
    const results = await PublishSettingRepository.findByApiToken(token);
    settings = results[0];
    if (settings) {
      formId = settings.formId;
    }
  }

  if (!settings || !settings.externalApi.enabled) {
    throw ApiError.forbidden('External API is not enabled for this form', 'EXTERNAL_API_DISABLED');
  }

  // 2. Find matching token
  const tokenConfig = settings.externalApi.tokens.find((t) => t.token === token);
  if (!tokenConfig) {
    throw ApiError.unauthorized('Invalid form token', 'INVALID_TOKEN');
  }

  // 3. Permission check
  if (!tokenConfig.permissions?.includes('WRITE')) {
    throw ApiError.forbidden('Token does not have WRITE permission', 'PERMISSION_DENIED');
  }

  // 4. Check expiration
  if (tokenConfig.expiresAt && new Date(tokenConfig.expiresAt) < new Date()) {
    throw ApiError.forbidden('Form token has expired', 'TOKEN_EXPIRED');
  }

  // 5. Validate form exists
  const form = await formRepository.findById(formId);
  if (!form) {
    throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');
  }

  // 6. Create the record
  const record = await formRecordRepository.create({
    formId: formId,
    appId: form.appId,
    data: req.body.data || req.body,
    createdBy: null,
    submitSource: 'EXTERNAL_API',
    sourceTokenName: tokenConfig.name,
  });

  return sendSuccess(res, {
    id: record.id,
  });
});

/**
 * Public record retrieval using a Form-Level Token.
 * Route: GET /api/v1/public/forms/:formId/external/records
 */
export const publicExternalGetRecords = asyncHandler(async (req, res) => {
  let { formId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const token = req.headers['x-form-token'];

  if (!token) {
    throw ApiError.unauthorized('X-Form-Token header is missing', 'TOKEN_MISSING');
  }

  // 1. Find settings (prefer formId from params, fallback to token-based lookup)
  let settings;
  if (formId) {
    settings = await PublishSettingRepository.findByFormId(formId);
  } else {
    const results = await PublishSettingRepository.findByApiToken(token);
    settings = results[0];
    if (settings) {
      formId = settings.formId;
    }
  }

  if (!settings || !settings.externalApi.enabled) {
    throw ApiError.forbidden('External API is not enabled for this form', 'EXTERNAL_API_DISABLED');
  }

  // 2. Find matching token
  const tokenConfig = settings.externalApi.tokens.find((t) => t.token === token);
  if (!tokenConfig) {
    throw ApiError.unauthorized('Invalid form token', 'INVALID_TOKEN');
  }

  // 3. Permission check
  if (!tokenConfig.permissions?.includes('READ')) {
    throw ApiError.forbidden('Token does not have READ permission', 'PERMISSION_DENIED');
  }

  // 4. Check expiration
  if (tokenConfig.expiresAt && new Date(tokenConfig.expiresAt) < new Date()) {
    throw ApiError.forbidden('Form token has expired', 'TOKEN_EXPIRED');
  }

  // 5. Fetch records
  const records = await formRecordRepository.findByFormId(formId, {
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
    sortBy: 'createdAt',
    order: 'desc'
  });
 
  const total = await formRecordRepository.countByFormId(formId);

  return sendSuccess(res, {
    records,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * Public record update using a Form-Level Token.
 * Route: POST /api/v1/public/forms/:formId/external/records/:recordId/update
 */
export const publicExternalUpdateRecord = asyncHandler(async (req, res) => {
  let { formId, recordId } = req.params;
  const token = req.headers['x-form-token'];

  if (!token) {
    throw ApiError.unauthorized('X-Form-Token header is missing', 'TOKEN_MISSING');
  }

  // 1. Find settings (prefer formId from params, fallback to token-based lookup)
  let settings;
  if (formId) {
    settings = await PublishSettingRepository.findByFormId(formId);
  } else {
    const results = await PublishSettingRepository.findByApiToken(token);
    settings = results[0];
    if (settings) {
      formId = settings.formId;
    }
  }

  if (!settings || !settings.externalApi.enabled) {
    throw ApiError.forbidden('External API is not enabled for this form', 'EXTERNAL_API_DISABLED');
  }

  // 2. Find matching token
  const tokenConfig = settings.externalApi.tokens.find((t) => t.token === token);
  if (!tokenConfig) {
    throw ApiError.unauthorized('Invalid form token', 'INVALID_TOKEN');
  }

  // 3. Permission check
  if (!tokenConfig.permissions?.includes('UPDATE')) {
    throw ApiError.forbidden('Token does not have UPDATE permission', 'PERMISSION_DENIED');
  }

  // 4. Check expiration
  if (tokenConfig.expiresAt && new Date(tokenConfig.expiresAt) < new Date()) {
    throw ApiError.forbidden('Form token has expired', 'TOKEN_EXPIRED');
  }

  // 5. Update the record
  const existing = await formRecordRepository.findOneByFormAndId(formId, recordId);
  if (!existing) {
    throw ApiError.notFound('Record not found or does not belong to this form', 'RECORD_NOT_FOUND');
  }
 
  const record = await formRecordRepository.update(recordId, {
    data: req.body.data || req.body,
    submitSource: 'EXTERNAL_API',
    sourceTokenName: tokenConfig.name,
    updatedAt: new Date(),
  });

  if (!record) {
    throw ApiError.notFound('Record not found or does not belong to this form', 'RECORD_NOT_FOUND');
  }

  return sendSuccess(res, record);
});

/**
 * Public record deletion using a Form-Level Token.
 * Route: POST /api/v1/public/forms/:formId/external/records/:recordId/delete
 */
export const publicExternalDeleteRecord = asyncHandler(async (req, res) => {
  let { formId, recordId } = req.params;
  const token = req.headers['x-form-token'];

  if (!token) {
    throw ApiError.unauthorized('X-Form-Token header is missing', 'TOKEN_MISSING');
  }

  // 1. Find settings (prefer formId from params, fallback to token-based lookup)
  let settings;
  if (formId) {
    settings = await PublishSettingRepository.findByFormId(formId);
  } else {
    const results = await PublishSettingRepository.findByApiToken(token);
    settings = results[0];
    if (settings) {
      formId = settings.formId;
    }
  }

  if (!settings || !settings.externalApi.enabled) {
    throw ApiError.forbidden('External API is not enabled for this form', 'EXTERNAL_API_DISABLED');
  }

  // 2. Find matching token
  const tokenConfig = settings.externalApi.tokens.find((t) => t.token === token);
  if (!tokenConfig) {
    throw ApiError.unauthorized('Invalid form token', 'INVALID_TOKEN');
  }

  // 3. Permission check
  if (!tokenConfig.permissions?.includes('DELETE')) {
    throw ApiError.forbidden('Token does not have DELETE permission', 'PERMISSION_DENIED');
  }

  // 4. Check expiration
  if (tokenConfig.expiresAt && new Date(tokenConfig.expiresAt) < new Date()) {
    throw ApiError.forbidden('Form token has expired', 'TOKEN_EXPIRED');
  }

  // 5. Delete the record
  const existing = await formRecordRepository.findOneByFormAndId(formId, recordId);
  if (!existing) {
    throw ApiError.notFound('Record not found or does not belong to this form', 'RECORD_NOT_FOUND');
  }
  await formRecordRepository.delete(recordId);

  return sendSuccess(res, { message: 'Record deleted successfully' });
});
