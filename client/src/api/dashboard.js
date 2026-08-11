import api from './index';

/**
 * Adds a new layout component to the user's dashboard view.
 * @param {Object} layoutComponentData - The data for the layout component.
 * @returns {Promise<Object>} The response data.
 */
export const addLayoutComponent = async (layoutComponentData) => {
  if (!layoutComponentData) throw new Error('layoutComponentData required');
  return api.post(`/dashboard/add-component`, layoutComponentData);
};

/**
 * Fetches the user's dashboard summary, including recent apps, favorites, documents, and the dashboard view layout.
 * @returns {Promise<Object>} An object containing recentApps, favorites, recentDocuments, and dashboardView.
 */
export const getDashboardSummary = async () => {
  return api.get(`/dashboard/summary`);
};

/**
 * Records an item as recently used for the current user.
 * @param {Object} item - The item to mark as recent.
 * @param {string} item.refId - The ID of the referenced item (e.g., Application ID, Document ID).
 * @param {string} item.refType - The type of the referenced item ('Application' or 'Document').
 * @returns {Promise<Object>} The response data.
 */
export const touchRecent = async ({ refId, refType }) => {
  if (!refId || !refType) throw new Error('refId and refType required');
  return api.post(`/dashboard/recent`, { refId, refType });
};

/**
 * Toggles the favorite status of an application for the current user.
 * @param {Object} data - The data for toggling favorite status.
 * @param {string} data.appId - The ID of the application.
 * @param {boolean} data.favorite - True to add to favorites, false to remove.
 * @returns {Promise<Object>} The response data.
 */
export const toggleFavorite = async ({ appId, favorite }) => {
  if (!appId) throw new Error('appId required');
  return api.post(`/dashboard/favorite`, { refId: appId, refType: 'Application', favorite });
};

/**
 * Sets (creates or updates) the entire dashboard view layout for the current user.
 * @param {Object} dashboardViewData - The complete dashboard view data, including the layout array.
 * @returns {Promise<Object>} The response data.
 */
export const setDashboardView = async (dashboardViewData) => {
  if (!dashboardViewData) throw new Error('dashboardViewData required');
  return api.post(`/dashboard/set-view`, dashboardViewData);
};

/**
 * Deletes a specific layout component from the user's dashboard view.
 * @param {string} layoutId - The unique ID of the layout component to delete.
 * @returns {Promise<Object>} The response data.
 */
export const deleteLayoutComponent = async (layoutId) => {
  if (!layoutId) throw new Error('layoutId required');
  return api.delete(`/dashboard/layout-component/${layoutId}`);
};
