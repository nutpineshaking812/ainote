import api from './index';

const cleanParams = (obj = {}) => {
  const entries = Object.entries(obj).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  return Object.fromEntries(entries);
};

export const listTemplates = async (params = {}) => {
  const safeParams = cleanParams(params);
  return api.get('/templates', { params: safeParams });
};

export const getTemplate = async (id) => {
  if (!id) throw new Error('id required');
  return api.get(`/templates/${id}`);
};

export const createTemplate = async (payload = {}) => {
  return api.post('/templates/create', payload);
};

export const updateTemplate = async (payload = {}) => {
  const { id, ...rest } = payload;
  if (!id) throw new Error('id required');
  return api.post('/templates/update', { id, ...rest });
};

export const deleteTemplate = async (id) => {
  if (!id) throw new Error('id required');
  return api.post('/templates/delete', { id });
};

export default {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
};
