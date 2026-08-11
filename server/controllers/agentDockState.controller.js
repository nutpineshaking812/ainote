import asyncHandler from 'express-async-handler';
import agentDockStateService from '../services/agentDockState.service.js';
import { sendSuccess } from '../utils/response.js';

/**
 * Agent Dock State Controller
 * 极致轻量化 (Thin Controller)
 * 仅负责请求解析、参数握手、调用 Service 并分发响应。
 */

// GET /get-detail
export const getDockState = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { targetId, scenario } = req.query;

  const result = await agentDockStateService.getDockState(userId, targetId, scenario);
  sendSuccess(res, result);
});

// POST /update
export const updateDockState = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { targetId, scenario, dockEmployeeIds, activeEmployeeId } = req.body;

  const result = await agentDockStateService.updateDockState(userId, {
    targetId,
    scenario,
    dockEmployeeIds,
    activeEmployeeId,
  });
  sendSuccess(res, result);
});
