import UserRecentRepository from '../repositories/userRecent.repository.js';
import UserFavoriteRepository from '../repositories/userFavorite.repository.js';
import ApplicationRepository from '../repositories/application.repository.js';
import DocumentRepository from '../repositories/document.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

// Get recent items (applications or documents) for the logged-in user
export const getRecentApps = async (req, res) => {
  try {
    const userId = req.user.id;
    const items = await UserRecentRepository.findByUserId(userId);
    if (!items || !items.length) return sendSuccess(res, []);

    // Partition ids by type
    const appIds = items.filter(i => i.refType === 'Application').map(i => i.refId).filter(Boolean).map(id => id.toString());
    const docIds = items.filter(i => i.refType === 'Document').map(i => i.refId).filter(Boolean);

    const [apps, docs] = await Promise.all([
      appIds.length ? ApplicationRepository.find().then(list => list.filter(a => appIds.includes(a.id))) : Promise.resolve([]),
      docIds.length ? DocumentRepository.findByIds(docIds) : Promise.resolve([])
    ]);

    const appMap = {};
    apps.forEach(a => { appMap[a.id] = a; });
    const docMap = {};
    docs.forEach(d => { docMap[d.id] = d; });

    const out = items.map(i => {
      const refIdStr = i.refId.toString();
      if (i.refType === 'Application') {
        const a = appMap[refIdStr];
        return a ? { _id: a.id, type: 'Application', name: a.name, icon: a.icon, iconColor: a.iconColor, lastUsedAt: i.lastUsedAt } : { _id: refIdStr, type: 'Application', lastUsedAt: i.lastUsedAt };
      }
      const d = docMap[refIdStr];
      return d ? { _id: d.id, type: 'Document', title: d.title, updatedAt: d.updatedAt, lastUsedAt: i.lastUsedAt } : { _id: refIdStr, type: 'Document', lastUsedAt: i.lastUsedAt };
    });

    return sendSuccess(res, out);
  } catch (err) {
    console.error(err);
    throw ApiError.internal('Server error', 'USER_RECENT_ERROR');
  }
};

// Push a recent item (application or document) to user's recents
export const pushRecentApp = async (req, res) => {
  try {
    const userId = req.user.id;
    let { appId, refId, refType } = req.body || {};
    if (appId && !refId) {
      refId = appId;
      refType = 'Application';
    }
    if (!refId || !refType) throw ApiError.badRequest('refId and refType required', 'REF_REQUIRED');

    await UserRecentRepository.touchRecent(userId, refType, refId);
    
    return sendSuccess(res, {});
  } catch (err) {
    console.error(err);
    throw ApiError.internal('Server error', 'PUSH_RECENT_ERROR');
  }
};

// Get user's favorites (applications and documents)
export const getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const items = await UserFavoriteRepository.findByUserId(userId);
    if (!items || !items.length) return sendSuccess(res, []);

    const appIds = items.filter(i => i.refType === 'Application').map(i => i.refId).filter(Boolean).map(id => id.toString());
    const docIds = items.filter(i => i.refType === 'Document').map(i => i.refId).filter(Boolean);

    const [apps, docs] = await Promise.all([
      appIds.length ? ApplicationRepository.find().then(list => list.filter(a => appIds.includes(a.id))) : Promise.resolve([]),
      docIds.length ? DocumentRepository.findByIds(docIds) : Promise.resolve([])
    ]);

    const appMap = {};
    apps.forEach(a => { appMap[a.id] = a; });
    const docMap = {};
    docs.forEach(d => { docMap[d.id] = d; });

    const out = items.map(i => {
      const refIdStr = i.refId.toString();
      if (i.refType === 'Application') {
        const a = appMap[refIdStr];
        return a ? { _id: a.id, type: 'Application', name: a.name, icon: a.icon, iconColor: a.iconColor, addedAt: i.addedAt } : { _id: refIdStr, type: 'Application', addedAt: i.addedAt };
      }
      const d = docMap[refIdStr];
      return d ? { _id: d.id, type: 'Document', title: d.title, addedAt: i.addedAt } : { _id: refIdStr, type: 'Document', addedAt: i.addedAt };
    });

    return sendSuccess(res, out);
  } catch (err) {
    console.error(err);
    throw ApiError.internal('Server error', 'USER_FAVORITES_ERROR');
  }
};

// Toggle favorite on/off
export const toggleFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    let { appId, docId, refId, refType, favorite } = req.body || {};
    if (appId && !refId) {
      refId = appId; refType = 'Application';
    }
    if (docId && !refId) {
      refId = docId; refType = 'Document';
    }
    if (!refId || !refType) throw ApiError.badRequest('refId and refType required', 'REF_REQUIRED');

    await UserFavoriteRepository.toggleFavorite(userId, refType, refId, favorite);
    
    return sendSuccess(res, {});
  } catch (err) {
    console.error(err);
    throw ApiError.internal('Server error', 'TOGGLE_FAVORITE_ERROR');
  }
};
