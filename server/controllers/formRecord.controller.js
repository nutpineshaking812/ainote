import asyncHandler from 'express-async-handler';
import formRecordService from '../services/formRecord.service.js';
import { sendSuccess } from '../utils/response.js';
import { buildFilename } from '../utils/excel.js';

/**
 * @desc    Submit data to a form (public access)
 * @route   POST /api/v1/data/submit
 * @access  Public
 */
export const submitFormRecord = asyncHandler(async (req, res) => {
  const { formId, data } = req.body;
  const payload = data && data.data ? data.data : data;
  const formRecord = await formRecordService.createFormRecord(formId, payload);
  sendSuccess(res, formRecord, 201);
});

/**
 * @desc    Get all data records for a specific form
 * @route   GET /api/v1/data
 * @access  Private
 */
export const getFormRecords = asyncHandler(async (req, res) => {
  const { formId } = req.query;
  const result = await formRecordService.getFormRecords(formId, req.user.id, req.query);
  sendSuccess(res, result);
});

/**
 * @desc    Update a specific data record
 * @route   POST /api/v1/data/update
 * @access  Private
 */
export const updateFormRecord = asyncHandler(async (req, res) => {
  const { id, ...rest } = req.body;
  const payload = rest.data ? rest.data : rest;
  const formRecord = await formRecordService.updateFormRecord(id, req.user.id, payload);
  sendSuccess(res, formRecord);
});

/**
 * @desc    Delete a specific data record
 * @route   POST /api/v1/data/delete
 * @access  Private
 */
export const deleteFormRecord = asyncHandler(async (req, res) => {
  const { id } = req.body;
  await formRecordService.deleteFormRecord(id, req.user.id);
  sendSuccess(res, { message: 'Record deleted successfully' });
});

/**
 * @desc    Create a new data record
 * @route   POST /api/v1/data/create
 * @access  Private
 */
export const createFormRecord = asyncHandler(async (req, res) => {
  const { formId, ...rest } = req.body;
  const payload = rest.data ? rest.data : rest;
  const formRecord = await formRecordService.createFormRecord(formId, payload, req.user.id);
  sendSuccess(res, formRecord, 201);
});

/**
 * @desc    Get distinct values for a field
 * @route   GET /api/v1/data/distinct-values
 * @access  Private
 */
export const getFieldDistinctValues = asyncHandler(async (req, res) => {
  const { formId, fieldId } = req.query;
  const result = await formRecordService.getFieldDistinctValues(formId, fieldId, req.user.id);
  sendSuccess(res, result);
});

/**
 * @desc    Batch create data records
 * @route   POST /api/v1/data/batch
 * @access  Private
 */
export const createFormRecordsBatch = asyncHandler(async (req, res) => {
    const { formId } = req.query;
    const items = req.body;
    const result = await formRecordService.createFormRecordsBatch(formId, req.user.id, items);
    sendSuccess(res, result, 201);
});

/**
 * @desc    Export form data to Excel
 * @route   GET /api/v1/data/export.xlsx
 * @access  Private
 */
export const exportFormRecordsExcel = asyncHandler(async (req, res) => {
    const { formId } = req.query;
    const { workbook, form } = await formRecordService.exportFormRecordsExcel(formId, req.user.id, req.query);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const filename = buildFilename(form, 'data');
    const encoded = encodeURIComponent(filename);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`);
    await workbook.xlsx.write(res);
    res.end();
});

/**
 * @desc    Export form template to Excel
 * @route   GET /api/v1/data/template.xlsx
 * @access  Private
 */
export const exportFormTemplateExcel = asyncHandler(async (req, res) => {
    const { formId } = req.query;
    const { workbook, form } = await formRecordService.exportFormTemplateExcel(formId, req.user.id);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const filename = buildFilename(form, 'template');
    const encoded = encodeURIComponent(filename);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`);
    await workbook.xlsx.write(res);
    res.end();
});

/**
 * @desc    Import form data from Excel
 * @route   POST /api/v1/data/import.xlsx
 * @access  Private
 */
export const importFormRecordsExcel = asyncHandler(async (req, res) => {
    const { formId } = req.query;
    if (!req.file) {
        throw new ApiError(400, 'No file uploaded');
    }
    const result = await formRecordService.importFormRecordsExcel(formId, req.user.id, req.file.buffer);
    sendSuccess(res, result, 201);
});

