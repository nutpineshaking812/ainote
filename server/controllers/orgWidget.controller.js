import service from '../services/orgWidget.service.js';
import { sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';

export const createWidget = async (req, res) => {
  const orgId = req.headers['x-organization-id'];
  if (!orgId) throw ApiError.badRequest('Organization ID required');
  const widget = await service.createWidget(orgId, req.body);
  return sendSuccess(res, widget);
};

export const getWidgets = async (req, res) => {
  const orgId = req.headers['x-organization-id'];
  if (!orgId) throw ApiError.badRequest('Organization ID required');
  const widgets = await service.getWidgetsByOrg(orgId);
  return sendSuccess(res, widgets);
};

export const updateWidget = async (req, res) => {
  const { widgetId } = req.params;
  const widget = await service.updateWidget(widgetId, req.body);
  return sendSuccess(res, widget);
};

export const deleteWidget = async (req, res) => {
  const { widgetId } = req.params;
  await service.deleteWidget(widgetId);
  return sendSuccess(res, { message: 'Widget deleted successfully' });
};

export default {
  createWidget,
  getWidgets,
  updateWidget,
  deleteWidget,
};
