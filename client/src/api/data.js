import api from './index';

// Public API to submit form data
export const submitFormData = async (formId, data) => {
  // The 'data' object from the form might be nested, e.g., { data: { field: 'value' } }
  // The backend controller has been updated to handle this.
  return api.post('/data/submit', { formId, data });
};

// Authenticated APIs for data management
export const getFormData = async (formId, params) => {
  return api.get('/data', { params: { formId, ...params } });
};

export const updateFormData = async (recordId, updatedData) => {
  return api.post('/data/update', { id: recordId, ...updatedData });
};

export const deleteFormData = async (recordId) => {
  return api.post('/data/delete', { id: recordId });
};

export const createDataRecord = async (formId, formData) => {
  return api.post('/data/create', { formId, ...formData });
};

export const getFormFieldDistinctValues = async (formId, fieldId) => {
  return api.get('/data/distinct-values', { params: { formId, fieldId } });
};

export const createDataRecordsBatch = async (formId, items) => {
  return api.post('/data/batch', items, { params: { formId } });
};

export const exportFormDataExcel = async (formId, params) => {
  return api.get('/data/export.xlsx', {
    params: { formId, ...params },
    responseType: 'blob',
  });
};

export const exportFormTemplateExcel = async (formId) => {
  return api.get('/data/template.xlsx', {
    params: { formId },
    responseType: 'blob',
  });
};

export const importFormDataExcel = async (formId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/data/import.xlsx', formData, {
    params: { formId },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
