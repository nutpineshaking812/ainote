import { formRecordRepository } from '../repositories/formRecord.repository.js';
import { formRepository } from '../repositories/form.repository.js';
import ApplicationRepository from '../repositories/application.repository.js';
import ApiError from '../utils/ApiError.js';
import {
  selectDataFields,
  sanitizeDataPayload,
  validateDataPayload,
  normalizeFieldsRecordable,
} from '../utils/formFieldUtils.js';
import {
  createWorkbook,
  buildTemplateSheet,
  buildMetaSheet,
} from '../utils/excel.js';
import { validateFieldsStructure } from '../utils/fieldValidator.js';
import ExcelJS from 'exceljs';
import workflowTriggerService from './workflow.trigger.service.js';

async function _getForm(formId) {
  const form = await formRepository.findById(formId);
  if (!form) {
    throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');
  }
  const application = await ApplicationRepository.findById(form.appId);
  if (!application) {
    throw ApiError.notFound('Application not found', 'APP_NOT_FOUND');
  }
  return { form, application };
}

async function _validateUniqueness(formId, normalizedFields, data, excludeRecordId = null) {
  const uniqueFieldsToCheck = [];
  for (const field of normalizedFields) {
    if (field.validation?.unique) {
      const value = data[field.id];
      if (value !== undefined && value !== null && value !== '') {
        uniqueFieldsToCheck.push({ fieldId: field.id, value });
      }
    }
  }

  if (uniqueFieldsToCheck.length > 0) {
    const conflictingRecord = await formRecordRepository.findConflictingRecordJoint(formId, uniqueFieldsToCheck);
    if (conflictingRecord && conflictingRecord.id !== excludeRecordId) {
      return conflictingRecord;
    }
  }
  return null;
}

const createFormRecord = async (formId, data, userId = null, options = {}) => {
  const { form, application } = await _getForm(formId);

  const normalizedFields = normalizeFieldsRecordable(form.fields);
  const sanitizedPayload = sanitizeDataPayload(normalizedFields, data);
  const validationErrors = validateDataPayload(normalizedFields, sanitizedPayload, {
    mode: 'create',
  });
  if (validationErrors.length) {
    throw ApiError.badRequest(validationErrors[0], 'DATA_VALIDATION');
  }

  const { upsert = false, ...otherOptions } = options;

  const conflictingRecord = await _validateUniqueness(form.id, normalizedFields, sanitizedPayload);
  if (conflictingRecord) {
    if (upsert) {
      // If joint unique record exists, update it instead of throwing an error
      return await updateFormRecord(conflictingRecord.id, userId, sanitizedPayload);
    } else {
      throw ApiError.badRequest(
        '联合唯一属性冲突，该记录已存在',
        'UNIQUENESS_VIOLATION',
      );
    }
  }

  const record = await formRecordRepository.create({
    formId: form.id,
    appId: form.appId,
    data: sanitizedPayload,
    createdBy: userId,
    ...otherOptions,
  });

  workflowTriggerService.triggerEvent('dataChange', {
    organizationId: application.organizationId,
    formId: form.id,
    event: 'create',
    data: record,
    triggeredBy: userId,
  });

  import('./resource.events.js').then((m) => {
    m.default.emitUpdated({ resourceId: form.id, type: 'form', appId: form.appId });
  });

  return record;
};

const getFormRecords = async (formId, userId, queryParams) => {
  const { form } = await _getForm(formId);

  const normalizedFields = normalizeFieldsRecordable(form.fields);
  const dataFields = selectDataFields(normalizedFields);
  const dataFieldIdSet = new Set(dataFields.map((f) => f.id));

  const { records, totalRecords } = await formRecordRepository.findRecordsPaged(
    formId,
    queryParams,
    dataFieldIdSet,
    dataFields
  );

  return {
    records,
    pagination: {
      currentPage: parseInt(queryParams.page || 1),
      totalPages: Math.ceil(totalRecords / parseInt(queryParams.limit || 10)),
      totalRecords,
    },
  };
};

const updateFormRecord = async (recordId, userId, updatedData) => {
  const existing = await formRecordRepository.findById(recordId);
  if (!existing) {
    throw ApiError.notFound('Data record not found', 'DATA_NOT_FOUND');
  }

  const { form, application } = await _getForm(existing.formId);

  const normalizedFields = normalizeFieldsRecordable(form.fields);
  const sanitizedData = sanitizeDataPayload(normalizedFields, updatedData);
  const updateValidationErrors = validateDataPayload(normalizedFields, sanitizedData, {
    mode: 'update',
  });
  if (updateValidationErrors.length) {
    throw ApiError.badRequest(updateValidationErrors[0], 'DATA_VALIDATION');
  }

  if (!Object.keys(sanitizedData).length) {
    return existing;
  }

  const mergedData = { ...(existing.data || {}), ...sanitizedData };

  const postMergeErrors = validateDataPayload(normalizedFields, mergedData, { mode: 'update' });
  if (postMergeErrors.length) {
    throw ApiError.badRequest(postMergeErrors[0], 'DATA_VALIDATION');
  }

  const conflictingRecord = await _validateUniqueness(form.id, normalizedFields, mergedData, recordId);
  if (conflictingRecord) {
    throw ApiError.badRequest(
      '联合唯一属性冲突，该记录已存在',
      'UNIQUENESS_VIOLATION',
    );
  }

  const updated = await formRecordRepository.update(recordId, { data: mergedData });

  workflowTriggerService.triggerEvent('dataChange', {
    organizationId: application.organizationId,
    formId: form.id,
    event: 'update',
    data: existing,
    triggeredBy: userId,
  });

  workflowTriggerService.signalDataUpdate(form.id, updated.id, updated.data);

  import('./resource.events.js').then((m) => {
    m.default.emitUpdated({ resourceId: form.id, type: 'form', appId: form.appId });
  });

  return updated;
};

const deleteFormRecord = async (recordId, userId) => {
  const record = await formRecordRepository.findById(recordId);
  if (!record) {
    throw ApiError.notFound('Data record not found', 'DATA_NOT_FOUND');
  }
  const { form } = await _getForm(record.formId);
  await formRecordRepository.delete(recordId);

  import('./resource.events.js').then((m) => {
    m.default.emitUpdated({ resourceId: form.id, type: 'form', appId: form.appId });
  });
};

const getFieldDistinctValues = async (formId, fieldId, userId) => {
  const { form } = await _getForm(formId);

  const normalizedFields = normalizeFieldsRecordable(form.fields || []);
  const targetField = normalizedFields.find((f) => f && f.id === fieldId);
  if (!targetField) {
    throw ApiError.notFound('Field not found on this form', 'FIELD_NOT_FOUND');
  }
  if (targetField.recordable === false) {
    throw ApiError.badRequest('Field is not recordable', 'FIELD_NOT_RECORDABLE');
  }

  const results = await formRecordRepository.findDistinctDataByFormId(formId);

  const dedupMap = new Map();
  results.forEach((doc) => {
    const raw = doc?.data ? doc.data[fieldId] : undefined;
    const pushValue = (val) => {
      if (val === undefined || val === null || val === '') return;
      const key = String(val);
      if (!dedupMap.has(key)) dedupMap.set(key, val);
    };
    if (Array.isArray(raw)) raw.forEach(pushValue);
    else pushValue(raw);
  });

  const values = Array.from(dedupMap.values());
  values.sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));

  return { values };
};

const createFormRecordsBatch = async (formId, userId, items, options = {}) => {
  if (!items || !items.length) {
    throw ApiError.badRequest('Empty batch payload');
  }

  const { form, application } = await _getForm(formId);
  const normalizedFields = normalizeFieldsRecordable(form.fields);

  const sanitizedItems = items.map((item) => sanitizeDataPayload(normalizedFields, item));
  for (let i = 0; i < sanitizedItems.length; i++) {
    const errs = validateDataPayload(normalizedFields, sanitizedItems[i], { mode: 'create' });
    if (errs.length) {
      throw ApiError.badRequest(errs[0], { failedIndex: i });
    }
  }

  const { upsert = false } = options;

  // createFormRecordsBatch handles its own transaction via formRecordRepository
  try {
    const insertedIds = [];
    const eventsToTrigger = [];

    const dbInstance = await import('../db/index.js');
    const { formRecords: formRecordsTable } = await import('../db/schema/index.js');
    const { and, eq, sql } = await import('drizzle-orm');

    await dbInstance.db.transaction(async (tx) => {
      for (const item of sanitizedItems) {
        // Build joint unique fields check
        const uniqueFieldsToCheck = [];
        for (const field of normalizedFields) {
          if (field.validation?.unique) {
            const value = item[field.id];
            if (value !== undefined && value !== null && value !== '') {
              uniqueFieldsToCheck.push({ fieldId: field.id, value });
            }
          }
        }

        let existingRecord = null;
        if (uniqueFieldsToCheck.length > 0) {
          const andConditions = uniqueFieldsToCheck.map(
            ({ fieldId, value }) => sql`${formRecordsTable.data}->>${fieldId} = ${value}`
          );
          const [found] = await tx
            .select()
            .from(formRecordsTable)
            .where(
              and(
                eq(formRecordsTable.formId, form.id),
                ...andConditions
              )
            )
            .limit(1);
          existingRecord = found;
        }

        if (existingRecord) {
          if (upsert) {
            // Merge and update existing record inside transaction
            const mergedData = { ...(existingRecord.data || {}), ...item };
            await tx
              .update(formRecordsTable)
              .set({ data: mergedData })
              .where(eq(formRecordsTable.id, existingRecord.id));

            insertedIds.push(existingRecord.id);

            eventsToTrigger.push({
              event: 'update',
              data: existingRecord,
              postData: { id: existingRecord.id, formId: form.id, appId: form.appId, data: mergedData }
            });
          } else {
            throw ApiError.badRequest(
              '联合唯一属性冲突，该记录已存在',
              'UNIQUENESS_VIOLATION',
            );
          }
        } else {
          // Insert new record in transaction
          const rec = await tx
            .insert(formRecordsTable)
            .values({
              formId: form.id,
              appId: form.appId,
              data: item,
              createdBy: userId,
            })
            .returning({ id: formRecordsTable.id });

          const newId = rec[0].id;
          insertedIds.push(newId);

          eventsToTrigger.push({
            event: 'create',
            data: { id: newId, formId: form.id, appId: form.appId, data: item, createdBy: userId }
          });
        }
      }
    });

    // Trigger all collected events after transaction commits successfully
    for (const evt of eventsToTrigger) {
      workflowTriggerService.triggerEvent('dataChange', {
        organizationId: application.organizationId,
        formId: form.id,
        event: evt.event,
        data: evt.data,
        triggeredBy: userId,
      });
      if (evt.event === 'update' && evt.postData) {
        workflowTriggerService.signalDataUpdate(form.id, evt.postData.id, evt.postData.data);
      }
    }

    import('./resource.events.js').then((m) => {
      m.default.emitUpdated({ resourceId: form.id, type: 'form', appId: form.appId });
    });

    return { inserted: insertedIds.length, atomic: true, ids: insertedIds };
  } catch (error) {
    throw error;
  }
};

const exportFormRecordsExcel = async (formId, userId, queryParams) => {
  const { form } = await _getForm(formId);
  const { sortBy = 'createdAt', order = 'desc' } = queryParams;

  const normalizedFields = normalizeFieldsRecordable(form.fields);
  validateFieldsStructure(normalizedFields);
  
  const records = await formRecordRepository.findByFormIdAll(formId, sortBy, order);

  const workbook = createWorkbook();
  const formForExport = { ...form, fields: normalizedFields };

  buildTemplateSheet(workbook, formForExport, records, { includeData: true });
  buildMetaSheet(workbook, formForExport, {});

  return { workbook, form };
};

const exportFormTemplateExcel = async (formId, userId) => {
  const { form } = await _getForm(formId);
  const normalizedFields = normalizeFieldsRecordable(form.fields);
  validateFieldsStructure(normalizedFields);

  const workbook = createWorkbook();
  const formForExport = { ...form, fields: normalizedFields };

  buildTemplateSheet(workbook, formForExport, null, { includeData: false });
  buildMetaSheet(workbook, formForExport, {});

  return { workbook, form };
};

const importFormRecordsExcel = async (formId, userId, fileBuffer) => {
  const { form, application } = await _getForm(formId);

  const normalizedFields = normalizeFieldsRecordable(form.fields || []);
  validateFieldsStructure(normalizedFields);

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(fileBuffer);
  } catch (e) {
    throw ApiError.badRequest('Excel 文件解析失败', { originalError: e.message });
  }

  const sheetName = workbook.worksheets.find((ws) => ws.name === '模板')
    ? '模板'
    : workbook.worksheets[0]
      ? workbook.worksheets[0].name
      : null;
  if (!sheetName) {
    throw ApiError.badRequest('Excel 文件不包含工作表');
  }
  const sheet = workbook.getWorksheet(sheetName);
  const headerRow = sheet.getRow(1);
  const headers = headerRow.values
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map((v) => String(v).trim());

  const fieldDefs = selectDataFields(normalizedFields);
  const labelToId = fieldDefs.reduce((acc, f) => {
    const lbl = f.properties?.label;
    if (lbl) acc[lbl.trim()] = f.id;
    return acc;
  }, {});

  const reverseOptionMap = {};
  fieldDefs.forEach((f) => {
    const selectionTypes = new Set(['radio-group', 'checkbox-group', 'dropdown', 'dropdown-checkbox', 'ranking']);
    if (selectionTypes.has(f.type)) {
      const opts = Array.isArray(f.properties?.options) ? f.properties.options : [];
      const map = {};
      opts.forEach((o) => {
        if (o && o.label != null && o.value != null) map[String(o.label).trim()] = o.value;
      });
      reverseOptionMap[f.id] = map;
    }
  });

  const mapping = {};
  headers.forEach((h) => {
    const clean = h.replace(/"/g, '').trim();
    if (labelToId[clean]) {
      mapping[h] = labelToId[clean];
    } else {
      mapping[h] = null;
    }
  });

  const dataRows = [];
  for (let rIndex = 2; rIndex <= sheet.rowCount; rIndex++) {
    const row = sheet.getRow(rIndex);
    if (!row || row.cellCount === 0) continue;
    let allEmpty = true;
    const rawCells = [];
    for (let cIndex = 1; cIndex <= headerRow.cellCount; cIndex++) {
      const cell = row.getCell(cIndex);
      let val = cell.value;
      if (val !== null && val !== undefined && val !== '') allEmpty = false;
      rawCells.push(val === undefined || val === null ? '' : val);
    }
    if (allEmpty) continue;
    dataRows.push(rawCells);
  }

  if (!dataRows.length) {
    return { inserted: 0 };
  }

  const activeMappings = Object.entries(mapping).filter(([h, fid]) => fid && fid !== 'createdAt');
  const records = dataRows.map((rowArr) => {
    const obj = {};
    activeMappings.forEach(([hdr, fid]) => {
      const idx = headers.indexOf(hdr);
      if (idx < 0) return;
      let raw = rowArr[idx];
      const fDef = fieldDefs.find((f) => f.id === fid);
      if (fDef) {
        if (['radio-group', 'dropdown'].includes(fDef.type)) {
          const map = reverseOptionMap[fid] || {};
          const trimmed = String(raw).trim();
          if (map[trimmed] !== undefined) raw = map[trimmed];
        } else if (['checkbox-group', 'dropdown-checkbox', 'ranking'].includes(fDef.type)) {
          const parts = String(raw).split(/\s*[|,；;]\s*/).filter((p) => p);
          const map = reverseOptionMap[fid] || {};
          raw = parts.map((p) => {
            const trimmed = p.trim();
            return map[trimmed] !== undefined ? map[trimmed] : trimmed;
          });
        }
      }
      obj[fid] = raw;
    });
    return obj;
  });

  try {
    const insertedIds = [];
    const dbInstance = await import('../db/index.js');
    const { formRecords: formRecordsTable } = await import('../db/schema/index.js');
    await dbInstance.db.transaction(async (tx) => {
      for (const dataObj of records) {
        const [rec] = await tx
          .insert(formRecordsTable)
          .values({
            formId: form.id,
            appId: form.appId,
            data: dataObj,
            createdBy: userId,
          })
          .returning({ id: formRecordsTable.id });
        insertedIds.push(rec.id);
      }
    });
    import('./resource.events.js').then((m) => {
      m.default.emitUpdated({ resourceId: form.id, type: 'form', appId: form.appId });
    });

    return { inserted: insertedIds.length, atomic: true };
  } catch (error) {
    throw error;
  }
};

export default {
  getFormRecords,
  updateFormRecord,
  deleteFormRecord,
  createFormRecord,
  getFieldDistinctValues,
  createFormRecordsBatch,
  exportFormRecordsExcel,
  exportFormTemplateExcel,
  importFormRecordsExcel,
};
