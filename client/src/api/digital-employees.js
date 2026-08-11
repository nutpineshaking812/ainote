import api from './index';

/**
 * 数字员工 (Digital Employees) API
 * 路径逻辑对齐后端路由挂载点: /apps/:appId/digital-employees
 */

// 获取列表 (GET /apps/:appId/digital-employees/get-list)
export const getDigitalEmployees = async (appId, scenario) => {
  return api.get(`/apps/${appId}/digital-employees/get-list`, {
    params: scenario ? { scenario } : undefined,
  });
};

// 获取详情 (GET /apps/:appId/digital-employees/get-detail)
export const getDigitalEmployee = async (appId, id) => {
  return api.get(`/apps/${appId}/digital-employees/get-detail`, { params: { id } });
};

/**
 * 创建数字员工
 */
export const createDigitalEmployee = async (appId, data) => {
  return api.post(`/apps/${appId}/digital-employees/create`, data);
};

/**
 * 更新数字员工
 */
export const updateDigitalEmployee = async (appId, data) => {
  // data should contain the 'id' of the employee
  return api.post(`/apps/${appId}/digital-employees/update`, data);
};

/**
 * 初始化数字员工的工作流大脑
 */
export const initDigitalEmployeeWorkflow = async (appId, id) => {
  return api.post(`/apps/${appId}/digital-employees/${id}/init-workflow`);
};

// 删除 (POST /apps/:appId/digital-employees/delete)
export const deleteDigitalEmployee = async (appId, id) => {
  return api.post(`/apps/${appId}/digital-employees/delete`, { id });
};

// 获取预设列表 (GET /apps/:appId/digital-employees/presets)
export const getDigitalEmployeePresets = async (appId) => {
  return api.get(`/apps/${appId}/digital-employees/presets`);
};
