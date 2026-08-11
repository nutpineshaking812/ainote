import api from './index';

const cleanParams = (obj = {}) => {
  const entries = Object.entries(obj).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  return Object.fromEntries(entries);
};

const BASE_URL = '/prompts';

export const listPrompts = async (appId, params = {}) => {
  const safeParams = cleanParams({ ...params, appId });
  return api.get(BASE_URL, { params: safeParams });
};

export const getPromptDashboard = async (appId) => {
  return api.get(`${BASE_URL}/dashboard`, { params: { appId } });
};

export const getPrompt = async (appId, id) => {
  if (!id) throw new Error('id required');
  return api.get(`${BASE_URL}/${id}`);
};

export const createPrompt = async (appId, payload = {}) => {
  return api.post(`${BASE_URL}/create`, { ...payload, appId });
};

export const updatePrompt = async (appId, payload = {}) => {
  const { id, ...rest } = payload;
  if (!id) throw new Error('id required');
  return api.post(`${BASE_URL}/update`, { id, ...rest, appId });
};

export const deletePrompt = async (appId, id) => {
  if (!id) throw new Error('id required');
  return api.post(`${BASE_URL}/delete`, { id });
};

export default {
  listPrompts,
  getPromptDashboard,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
};
