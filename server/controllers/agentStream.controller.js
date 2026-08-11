import asyncHandler from 'express-async-handler';
import env from '../config/env.js';
import { UnifiedChatService } from '../services/ai/UnifiedChatService.js';
import { getSupportedProviders } from '../agent/llm/langchainAi.js';
import { sendSuccess } from '../utils/response.js';
import { SSEWriter } from '../utils/stream.protocol.js';
import digitalEmployeeService from '../services/digitalEmployee.service.js';
import { EMPLOYEE_SCENARIOS } from '../constants/digitalEmployee.js';

/**
 * 数字员工对话流端点 (SSE)
 */
export const employeeStream = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { conversationId, content, inputs, refs } = req.body;
  const orgId = req.headers['x-org-id'] || req.user.orgId;
  const clientPlatform = req.headers['x-client-platform'] || '';

  const writer = new SSEWriter(res);

  return digitalEmployeeService.streamEmployeeChat(writer, {
    employeeId,
    user: req.user,
    orgId,
    conversationId,
    message: content || '',
    data: inputs || {},
    refs: refs || [],
    clientPlatform,
  });
});

export const unifiedStream = asyncHandler(async (req, res) => {
  const {
    appId,
    conversationId,
    content,
    inputs,
    scenario,
    model,
    systemPrompt,
    skillIds,
    refs,
    messages,
    toolDefinitions,
    targetId,
  } = req.body;
  const { docId } = req.params;
  const orgId = req.headers['x-org-id'] || req.user.orgId;
  const clientPlatform = req.headers['x-client-platform'] || '';

  const isBlockNote = req.path.includes('blocknote') || scenario === 'document';

  const service = new UnifiedChatService({ user: req.user, appId, orgId, clientPlatform });
  const writer = new SSEWriter(res);

  const resolvedScenario =
    scenario ||
    (isBlockNote
      ? EMPLOYEE_SCENARIOS.DOCUMENT
      : docId
        ? EMPLOYEE_SCENARIOS.DOCUMENT
        : EMPLOYEE_SCENARIOS.GENERAL);

  return service.streamChat(writer, {
    appId,
    conversationId,
    message: content || '',
    model: model || 'openai',
    skillIds: skillIds || [],
    systemPrompt:
      systemPrompt ||
      (isBlockNote
        ? 'You are a document assistant. Help the user edit and improve their content. Output in professional HTML or Markdown as requested.'
        : 'You are a helpful assistant.'),
    docId,
    refs,
    scenario: resolvedScenario,
    type: resolvedScenario,
    messages: messages || [],
    data: inputs || {},
    toolDefinitions,
    targetId,
  });
});

/**
 * 获取可用模型列表
 */
export const getAvailableModels = asyncHandler(async (req, res) => {
  const { llmProviders } = env;
  const supported = getSupportedProviders();

  const providers = Object.keys(llmProviders)
    .filter((key) => supported.includes(key))
    .map((key) => ({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      model: llmProviders[key].model,
      models: llmProviders[key].models || [llmProviders[key].model],
    }));

  sendSuccess(res, providers);
});

export default {
  employeeStream,
  getAvailableModels,
  unifiedStream,
};
