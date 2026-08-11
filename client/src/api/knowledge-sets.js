import api from './index';

/**
 * 知识集 (Knowledge Sets) API
 * 遵循前端规范 2.2：显式参数签名 (对象解构)
 * 路径逻辑对齐后端路由挂载点: /apps/:appId/knowledge-sets
 */

// 获取列表 (GET /apps/:appId/knowledge-sets/list)
export const getKnowledgeSets = async ({ appId }) => {
  return api.get(`/apps/${appId}/knowledge-sets/list`);
};

// 获取详情 (GET /apps/:appId/knowledge-sets/get/:id)
export const getKnowledgeSet = async ({ appId, id }) => {
  return api.get(`/apps/${appId}/knowledge-sets/get/${id}`);
};

/**
 * 创建知识集
 */
export const createKnowledgeSet = async ({ appId, name, description }) => {
  return api.post(`/apps/${appId}/knowledge-sets/create`, {
    name,
    description,
  });
};

/**
 * 更新知识集
 */
export const updateKnowledgeSet = async ({ appId, id, name, description }) => {
  return api.post(`/apps/${appId}/knowledge-sets/update`, {
    id,
    name,
    description,
  });
};

/**
 * 删除知识集
 */
export const deleteKnowledgeSet = async ({ appId, id }) => {
  return api.post(`/apps/${appId}/knowledge-sets/delete`, { id });
};

/**
 * 批量向知识集添加资源
 */
export const addItems = async ({ appId, id, resourceIds }) => {
  return api.post(`/apps/${appId}/knowledge-sets/add-items/${id}`, { resourceIds });
};

/**
 * 获取知识集下的资源列表
 */
export const getItems = async ({ appId, id }) => {
  return api.get(`/apps/${appId}/knowledge-sets/get-items/${id}`);
};

/**
 * 从知识集中移除资源
 */
export const removeItem = async ({ appId, id, resourceId }) => {
  return api.post(`/apps/${appId}/knowledge-sets/remove-item/${id}`, { resourceId });
};

/**
 * 测试召回效果
 */
export const testRetrieval = async ({ appId, id, query, limit = 5 }) => {
  return api.post(`/apps/${appId}/knowledge-sets/test-retrieval/${id}`, { query, limit });
};

/**
 * 手动同步单个资源
 */
export const syncItem = async ({ appId, id, resourceId }) => {
  return api.post(`/apps/${appId}/knowledge-sets/sync-item/${id}`, { resourceId });
};

export default {
  getKnowledgeSets,
  getKnowledgeSet,
  createKnowledgeSet,
  updateKnowledgeSet,
  deleteKnowledgeSet,
  addItems,
  getItems,
  removeItem,
  testRetrieval,
  syncItem,
};
