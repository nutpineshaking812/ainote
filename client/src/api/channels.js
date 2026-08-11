import api from './index';

/**
 * Channel Management API
 * Handles connection settings for DingTalk, etc.
 */
export const getAppChannels = (appId) => {
  return api.get(`/channels`, { params: { appId } });
};

export const createChannel = (data) => {
  return api.post('/channels/create', data);
};

export const updateChannel = (id, data) => {
  return api.post('/channels/update', { id, ...data });
};

export const deleteChannel = (id) => {
  return api.post('/channels/delete', { id });
};

export const testChannelConnection = (id) => {
  return api.get(`/channels/${id}/test`);
};
