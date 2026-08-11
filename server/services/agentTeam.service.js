import AgentTeamRepository from '../repositories/agentTeam.repository.js';
import accessService from './access.service.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * 项目组 Service 层
 */

const getTeams = async (appId, userId) => {
  // 核心安全权限校验
  await accessService.ensureAppAccess(appId, userId);
  return AgentTeamRepository.findByApp(appId);
};

const createTeam = async (appId, { name, ceoEmployeeId, memberEmployeeIds, conversationId }, userId) => {
  // 核心安全权限校验
  await accessService.ensureAppAccess(appId, userId);

  if (!name) {
    throw ApiError.badRequest('项目组名称是必填项', 'AT_NAME_REQUIRED');
  }
  if (!ceoEmployeeId) {
    throw ApiError.badRequest('必须指派一位 CEO', 'AT_CEO_REQUIRED');
  }

  return AgentTeamRepository.create({
    appRef: appId,
    name,
    ceoEmployeeId,
    memberEmployeeIds: memberEmployeeIds || [],
    conversationId: conversationId || null,
    status: 'RUNNING',
    createdBy: userId,
  });
};

const deleteTeam = async (id, appId, userId) => {
  // 核心安全权限校验
  await accessService.ensureAppAccess(appId, userId);
  await AgentTeamRepository.delete(id);
  return { message: 'Agent team deleted successfully' };
};

export default {
  getTeams,
  createTeam,
  deleteTeam,
};
