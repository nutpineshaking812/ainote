import api from './index';

export const getRecentApps = async () => {
  return api.get('/user-activity/recent-apps');
};

// pushRecent accepts either { appId } (legacy) or { refId, refType }
export const pushRecentApp = async (payload) => {
  let body = {};
  if (payload.refId && payload.refType) body = { refId: payload.refId, refType: payload.refType };
  else if (payload.appId) body = { refId: payload.appId, refType: 'Application' };
  else body = payload;
  return api.post('/user-activity/recent-apps', body);
};

export const getFavorites = async () => {
  return api.get('/user-activity/favorites');
};

// toggleFavorite accepts { appId, favorite } or { docId, favorite } or { refId, refType, favorite }
export const toggleFavorite = async (payload) => {
  let body = {};
  if (payload.refId && payload.refType)
    body = { refId: payload.refId, refType: payload.refType, favorite: payload.favorite };
  else if (payload.appId)
    body = { refId: payload.appId, refType: 'Application', favorite: payload.favorite };
  else if (payload.docId)
    body = { refId: payload.docId, refType: 'Document', favorite: payload.favorite };
  else body = payload;
  return api.post('/user-activity/favorites/toggle', body);
};
