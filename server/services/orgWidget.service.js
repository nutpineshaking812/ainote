import OrgWidgetRepository from '../repositories/orgWidget.repository.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Create a new organizational widget
 */
export const createWidget = async (orgId, widgetData) => {
  return OrgWidgetRepository.create({ ...widgetData, orgId });
};

/**
 * Get all widgets for an organization
 */
export const getWidgetsByOrg = async (orgId) => {
  const widgets = await OrgWidgetRepository.findByOrg(orgId);
  return widgets.map(w => ({ ...w, _id: w.id }));
};

/**
 * Update a widget
 */
export const updateWidget = async (widgetId, updateData) => {
  const widget = await OrgWidgetRepository.update(widgetId, updateData);
  if (!widget) throw ApiError.notFound('Widget not found');
  return { ...widget, _id: widget.id };
};

/**
 * Delete a widget
 */
export const deleteWidget = async (widgetId) => {
  const widget = await OrgWidgetRepository.delete(widgetId);
  if (!widget) throw ApiError.notFound('Widget not found');
  return widget;
};

export default {
  createWidget,
  getWidgetsByOrg,
  updateWidget,
  deleteWidget,
};
