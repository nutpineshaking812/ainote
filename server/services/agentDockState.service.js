import AgentDockStateRepository from '../repositories/agentDockState.repository.js';
import { EMPLOYEE_SCENARIOS } from '../constants/digitalEmployee.js';

/**
 * Agent Dock State Service
 * 业务大脑：负责数字员工 Dock 坞状态的查询和持久化更新。
 * 严禁包含 Drizzle 语法或 SQL。
 */

/**
 * 获取特定用户在特定业务对象、特定场景下的 Dock 坞状态
 *
 * @param {string} userId - 用户 ID
 * @param {string} targetId - 业务对象 ID (文档 ID / 表单 ID 等)
 * @param {string} scenario - 场景标识
 */
const getDockState = async (userId, targetId, scenario) => {
  if (!userId || !targetId) return null;
  return AgentDockStateRepository.findByUserAndTarget(userId, targetId, scenario || EMPLOYEE_SCENARIOS.GENERAL);
};

/**
 * 更新或创建 Dock 坞状态 (Upsert 逻辑)
 *
 * @param {string} userId - 用户 ID
 * @param {Object} params - 显式解构参数
 * @param {string} params.targetId - 业务对象 ID
 * @param {string} params.scenario - 场景标识
 * @param {Array<string>} params.dockEmployeeIds - 已停靠员工 ID 列表
 * @param {string} [params.activeEmployeeId] - 当前聚焦的员工 ID
 */
const updateDockState = async (
  userId,
  { targetId, scenario, dockEmployeeIds, activeEmployeeId },
) => {
  const currentScenario = scenario || EMPLOYEE_SCENARIOS.GENERAL;

  // 查找现有记录
  const existing = await getDockState(userId, targetId, currentScenario);

  if (existing) {
    // 更新
    return AgentDockStateRepository.update(existing.id, {
      dockEmployeeIds: dockEmployeeIds || [],
      activeEmployeeId: activeEmployeeId || null,
      updatedAt: new Date(),
    });
  } else {
    // 创建
    return AgentDockStateRepository.create({
      userId,
      targetId,
      scenario: currentScenario,
      dockEmployeeIds: dockEmployeeIds || [],
      activeEmployeeId: activeEmployeeId || null,
    });
  }
};

export default {
  getDockState,
  updateDockState,
};
