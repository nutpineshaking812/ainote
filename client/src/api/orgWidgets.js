import api from './index';

/**
 * Create a new organizational widget
 */
export const createWidget = async (widgetData) => {
  return api.post('/org-widgets/create', widgetData);
};

/**
 * Get all widgets for the current organization
 */
export const getWidgets = async () => {
  return api.get('/org-widgets');
};

/**
 * Update a widget
 */
export const updateWidget = async (widgetId, updateData) => {
  return api.post(`/org-widgets/${widgetId}/update`, updateData);
};

/**
 * Delete a widget
 */
export const deleteWidget = async (widgetId) => {
  return api.post(`/org-widgets/${widgetId}/delete`);
};

export default {
  createWidget,
  getWidgets,
  updateWidget,
  deleteWidget,
};
