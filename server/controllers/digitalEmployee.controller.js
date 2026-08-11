import asyncHandler from 'express-async-handler';
import digitalEmployeeService from '../services/digitalEmployee.service.js';
import { sendSuccess } from '../utils/response.js';

/**
 * 数字员工 Controller
 * 准则：显式剥离核心 ID（appId, id），简单对象建议在 Controller 层解构。
 */

// GET /get-list
export const getEmployees = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { scenario } = req.query;
  sendSuccess(res, await digitalEmployeeService.getEmployees(appId, scenario));
});

// GET /get-detail?id=xxx
export const getEmployee = asyncHandler(async (req, res) => {
  const { id } = req.query;
  sendSuccess(res, await digitalEmployeeService.getEmployeeById(id));
});

// POST /create
export const createEmployee = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const userId = req.user._id.toString();
  // 此处可选择性解构，或者将 body 作为一个配置对象传入
  sendSuccess(res, await digitalEmployeeService.createEmployee(appId, req.body, userId), 201);
});

// POST /update
export const updateEmployee = asyncHandler(async (req, res) => {
  const { id } = req.body; // 核心 ID 必须显式提取
  const userId = req.user._id.toString();
  sendSuccess(res, await digitalEmployeeService.updateEmployee(id, req.body, userId));
});

// POST /delete
export const deleteEmployee = asyncHandler(async (req, res) => {
  const { id } = req.body; // 核心 ID 必须显式提取
  await digitalEmployeeService.deleteEmployee(id);
  sendSuccess(res, { message: 'Digital employee deleted successfully' });
});

// POST /:id/init-workflow
export const initializeWorkflow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id.toString();
  sendSuccess(res, await digitalEmployeeService.initializeWorkflow(id, userId));
});

// GET /presets
export const getPresets = asyncHandler(async (req, res) => {
  sendSuccess(res, await digitalEmployeeService.getPresetEmployees());
});

