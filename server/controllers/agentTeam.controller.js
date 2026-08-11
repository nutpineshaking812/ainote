import asyncHandler from 'express-async-handler';
import agentTeamService from '../services/agentTeam.service.js';
import { sendSuccess } from '../utils/response.js';

/**
 * 协同项目组 Controller
 */

// GET /apps/:appId/agent-teams/get-list
export const getTeams = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const userId = req.user._id.toString();
  sendSuccess(res, await agentTeamService.getTeams(appId, userId));
});

// POST /apps/:appId/agent-teams/create
export const createTeam = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const userId = req.user._id.toString();
  sendSuccess(res, await agentTeamService.createTeam(appId, req.body, userId), 201);
});

// POST /apps/:appId/agent-teams/delete
export const deleteTeam = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { id } = req.body; // 显式获取核心 id
  const userId = req.user._id.toString();
  sendSuccess(res, await agentTeamService.deleteTeam(id, appId, userId));
});
