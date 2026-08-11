import api from './index';

/**
 * 获取 Agent Dock 坞状态
 * 
 * @param {string} targetId - 业务对象 ID (文档 ID / 表单 ID 等)
 * @param {string} scenario - 场景标识 (如 DOCUMENT)
 */
export const getAgentDockState = async (targetId, scenario) => {
  return api.get('/agent-dock-states/get-detail', { params: { targetId, scenario } });
};

/**
 * 更新 Agent Dock 坞状态
 * 
 * @param {Object} data - 状态数据
 * @param {string} data.targetId - 业务对象 ID
 * @param {string} data.scenario - 场景标识
 * @param {Array<string>} data.dockEmployeeIds - 已停靠员工 ID 列表
 * @param {string} [data.activeEmployeeId] - 当前聚焦的员工 ID
 */
export const updateAgentDockState = async (data) => {
  return api.post('/agent-dock-states/update', data);
};
