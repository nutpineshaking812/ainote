import asyncHandler from 'express-async-handler';
import { formRepository } from '../repositories/form.repository.js';
import { formRecordRepository } from '../repositories/formRecord.repository.js';
import PublishSettingRepository from '../repositories/publishSetting.repository.js';
import { hashAccessCode, isExpired, filterDataByPermissions } from '../utils/publishUtils.js';
import {
  selectDataFields,
  sanitizeDataPayload,
  validateDataPayload,
  normalizeFieldsRecordable,
} from '../utils/formFieldUtils.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { db } from '../db/index.js';
import { formRecords as formRecordsTable } from '../db/schema/index.js';
import { sql } from 'drizzle-orm';
import formRecordService from '../services/formRecord.service.js';

function selectBlock(settings, mode) {
  if (mode === 'query') return settings.queryLink;
  if (mode === 'record') return settings.recordShare; // only global flag check, per-record meta handled elsewhere
  return settings.fillLink;
}

// GET /public/forms/:formId?mode=fill|query|record
export const publicGetForm = asyncHandler(async (req, res) => {
  const { formId } = req.params;
  const mode = (req.query.mode || 'fill').trim();
  const form = await formRepository.findById(formId);
  if (!form) throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');

  const settings = await PublishSettingRepository.findByFormId(formId);
  if (!settings) throw ApiError.forbidden('Public access disabled', 'PUBLIC_DISABLED');

  const block = selectBlock(settings, mode);
  if (!block || !block.isPublic)
    throw ApiError.forbidden('Public access disabled', 'PUBLIC_DISABLED');

  // Access code + expiry only for fill/query blocks
  if (mode === 'fill' || mode === 'query') {
    if (block.useLinkExpiry && isExpired(block.linkExpiresAt)) {
      return sendSuccess(res, { accessRequired: true, reason: 'expired' });
    }
    if (block.useAccessCode) {
      const provided = (req.query.accessCode || '').trim();
      if (!provided) {
        return sendSuccess(res, { accessRequired: true, reason: 'access_code' });
      }
      if (hashAccessCode(provided) !== block.accessCodeHash) {
        throw ApiError.forbidden('Invalid access code', 'ACCESS_CODE_INVALID');
      }
    }
  }

  const normalizedFields = normalizeFieldsRecordable(form.fields || []);
  const normalizedForm = { ...form, fields: normalizedFields };

  // For query mode, filter fields by permissions (only return visible fields)
  let fields = normalizedFields;
  if (
    mode === 'query' &&
    block.fieldPermissions &&
    Object.keys(block.fieldPermissions).length > 0
  ) {
    const permissions = block.fieldPermissions;
    fields = normalizedFields.filter((field) => {
      const perm = permissions[field.id];
      return perm && perm.visible === true;
    });
    fields = selectDataFields(fields);
  } else if (mode === 'query') {
    fields = selectDataFields(fields);
  }

  const response = {
    accessRequired: false,
    _id: normalizedForm.id,
    name: normalizedForm.name,
    description: normalizedForm.description,
    showIndex: normalizedForm.showIndex,
    fields,
    actions: normalizedForm.actions,
  };
  return sendSuccess(res, response);
});

// POST /public/forms/:formId/submit (fill mode)
export const publicSubmitForm = asyncHandler(async (req, res) => {
  const { formId } = req.params;
  const form = await formRepository.findById(formId);
  if (!form) throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');
  const settings = await PublishSettingRepository.findByFormId(formId);
  if (!settings || !settings.fillLink.isPublic)
    throw ApiError.forbidden('Public access disabled', 'PUBLIC_DISABLED');
  const fill = settings.fillLink;
  if (fill.useLinkExpiry && isExpired(fill.linkExpiresAt))
    throw ApiError.forbidden('Link expired', 'LINK_EXPIRED');
  if (fill.useAccessCode) {
    const provided = (req.body.accessCode || '').trim();
    if (!provided) throw ApiError.forbidden('Access code required', 'ACCESS_CODE_REQUIRED');
    if (hashAccessCode(provided) !== fill.accessCodeHash)
      throw ApiError.forbidden('Invalid access code', 'ACCESS_CODE_INVALID');
  }

  const payload = req.body.data || {};
  
  // Call the core service to handle validation, unique checks, creation, and workflow trigger
  const record = await formRecordService.createFormRecord(formId, payload, null, {
    submitSource: 'WEB_FORM',
  });

  return sendSuccess(res, record, 201);
});

// GET /public/forms/:formId/records (query mode)
export const publicQueryRecords = asyncHandler(async (req, res) => {
  const { formId } = req.params;
  const { page = 1, limit = 10, q } = req.query;
  const form = await formRepository.findById(formId);
  if (!form) throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');
  const settings = await PublishSettingRepository.findByFormId(formId);
  if (!settings || !settings.queryLink.isPublic)
    throw ApiError.forbidden('Public access disabled', 'PUBLIC_DISABLED');
  const queryLink = settings.queryLink;
  if (queryLink.useLinkExpiry && isExpired(queryLink.linkExpiresAt))
    throw ApiError.forbidden('Link expired', 'LINK_EXPIRED');
  if (queryLink.useAccessCode) {
    const provided = (req.query.accessCode || '').trim();
    if (!provided) throw ApiError.forbidden('Access code required', 'ACCESS_CODE_REQUIRED');
    if (hashAccessCode(provided) !== queryLink.accessCodeHash)
      throw ApiError.forbidden('Invalid access code', 'ACCESS_CODE_INVALID');
  }
  const normalizedFields = normalizeFieldsRecordable(form.fields || []);
  const dataFields = selectDataFields(normalizedFields);
  let extraWhere = null;

  if (q && typeof q === 'string' && q.trim()) {
    const searchTerm = `%${q.trim()}%`;
    let searchableFields = dataFields;
    if (queryLink.fieldPermissions && Object.keys(queryLink.fieldPermissions).length > 0) {
      searchableFields = searchableFields.filter((f) => {
        const perm = queryLink.fieldPermissions[f.id];
        return perm && perm.visible === true;
      });
    }
    
    if (searchableFields.length > 0) {
      const orSql = searchableFields.map(f => sql`${formRecordsTable.data}->>${f.id} ILIKE ${searchTerm}`);
      extraWhere = (t, { or }) => or(...orSql);
    }
  }
  
  const records = await formRecordRepository.findAll({
    where: (t, { and, eq, or }) => {
      const conds = [eq(t.formId, formId)];
      if (extraWhere) conds.push(extraWhere(t, { or }));
      return and(...conds);
    },
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
    order: (t, { desc }) => [desc(t.createdAt)]
  });
 
  const total = await formRecordRepository.count({
    where: (t, { and, eq, or }) => {
      const conds = [eq(t.formId, formId)];
      if (extraWhere) conds.push(extraWhere(t, { or }));
      return and(...conds);
    }
  });
  const filteredRecords = records.map((r) => ({
    _id: r.id,
    data: filterDataByPermissions(r.data || {}, queryLink.fieldPermissions),
    createdAt: r.createdAt,
  }));
  return sendSuccess(res, {
    records: filteredRecords,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalRecords: total,
    },
  });
});
