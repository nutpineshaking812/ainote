import api from './index';

let pluginsCache = [];
let fetchPromise = null;

export const getPlugins = async (forceRefresh = false) => {
    if (!forceRefresh && pluginsCache.length > 0) return pluginsCache;
    if (fetchPromise) return fetchPromise;
    
    fetchPromise = api.get('/plugins/all').then(data => {
        pluginsCache = data || [];
        fetchPromise = null;
        return pluginsCache;
    });
    return fetchPromise;
};

export const getPluginMetaSync = (pluginId) => {
    if (!pluginId) return null;
    return pluginsCache.find(p => p.id === pluginId) || null;
};

export const getPluginStatus = async (pluginIds = null) => {
    const params = pluginIds ? { ids: pluginIds.join(',') } : {};
    return api.get('/plugins/status', { params });
};
