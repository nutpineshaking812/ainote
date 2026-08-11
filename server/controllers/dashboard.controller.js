import { sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import service from '../services/dashboard.service.js';

export async function getFavorites(req, res) {
  try {
    const organizationId = req.headers['x-organization-id'];
    const out = await service.listFavorites(req.user.id, organizationId);
    return sendSuccess(res, out);
  } catch (err) {
    console.error(err);
    throw ApiError.internal('Failed to get favorites', 'DASHBOARD_FAVORITES_ERROR');
  }
}

export async function getRecents(req, res) {
  try {
    const organizationId = req.headers['x-organization-id'];
    const out = await service.listRecents(req.user.id, organizationId);
    return sendSuccess(res, out);
  } catch (err) {
    console.error(err);
    throw ApiError.internal('Failed to get recents', 'DASHBOARD_RECENTS_ERROR');
  }
}

export async function toggleFavorite(req, res) {
  try {
    const { refId, refType, favorite } = req.body || {};
    const organizationId = req.headers['x-organization-id'];
    if (!refId || !refType) throw ApiError.badRequest('refId & refType required', 'REF_REQUIRED');
    await service.toggleFavorite(req.user.id, organizationId, refType, refId, !!favorite);
    return sendSuccess(res, {});
  } catch (err) {
    console.error(err);
    throw ApiError.internal('Failed to toggle favorite', 'DASHBOARD_TOGGLE_FAVORITE_ERROR');
  }
}

export async function touchRecent(req, res) {
  try {
    const { refId, refType } = req.body || {};
    const organizationId = req.headers['x-organization-id'];
    if (!refId || !refType) throw ApiError.badRequest('refId & refType required', 'REF_REQUIRED');
    await service.touchRecent(req.user.id, organizationId, refType, refId);
    return sendSuccess(res, {});
  } catch (err) {
    console.error(err);
    throw ApiError.internal('Failed to touch recent', 'DASHBOARD_TOUCH_RECENT_ERROR');
  }
}

export async function getSummary(req, res) {
  try {
    const organizationId = req.headers['x-organization-id'];
    const out = await service.getDashboardSummary(req.user.id, organizationId);
    return sendSuccess(res, out);
  } catch (err) {
    console.error(err);
    throw ApiError.internal('Failed to get dashboard summary', 'DASHBOARD_SUMMARY_ERROR');
  }
}

export async function setDashboardView(req, res) {
  try {
    const organizationId = req.headers['x-organization-id'];
    await service.setDashboardView(req.user.id, organizationId, req.body);
    return sendSuccess(res, { message: 'Dashboard view updated successfully' });
  } catch (err) {
    console.error(err);
    if (err.name === 'ApiError') throw err;
    throw ApiError.internal('Failed to update dashboard view', 'DASHBOARD_UPDATE_VIEW_ERROR');
  }
}

export async function addLayoutComponent(req, res) {
  try {
    const organizationId = req.headers['x-organization-id'];
    const message = await service.addLayoutComponent(req.user.id, organizationId, req.body);
    return sendSuccess(res, message);
  } catch (err) {
    console.error(err);
    if (err.name === 'ApiError') throw err;
    throw ApiError.internal(
      'Failed to add layout component',
      'DASHBOARD_ADD_LAYOUT_COMPONENT_ERROR',
    );
  }
}

export async function deleteLayoutComponent(req, res) {
  try {
    const { layoutId } = req.params;
    const organizationId = req.headers['x-organization-id'];
    const message = await service.deleteLayoutComponent(req.user.id, organizationId, layoutId);
    return sendSuccess(res, message);
  } catch (err) {
    console.error(err);
    if (err.name === 'ApiError') throw err;
    throw ApiError.internal(
      'Failed to delete layout component',
      'DASHBOARD_DELETE_LAYOUT_COMPONENT_ERROR',
    );
  }
}

export default {
  getFavorites,
  getRecents,
  toggleFavorite,
  touchRecent,
  getSummary,
  setDashboardView,
  addLayoutComponent,
  deleteLayoutComponent,
};
