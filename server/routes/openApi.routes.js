import express from 'express';
import {
  submitForm,
  getRecords,
  verifyApiKey,
  createSession,
  getEmployees,
  chatWithEmployee,
  listConversations,
  getConversationMessages,
} from '../controllers/openApi.controller.js';

const router = express.Router();

// ─────────────────────────────────────────────
// 会话认证（用 API Key 换取 JWT，用于嵌入 UI）
// ─────────────────────────────────────────────
router.post('/apps/:appId/session', createSession);

// ─────────────────────────────────────────────
// 表单数据接口
// ─────────────────────────────────────────────
router.post('/apps/:appId/forms/:formId/submit', verifyApiKey, submitForm);
router.get('/apps/:appId/forms/:formId/records', verifyApiKey, getRecords);

// ─────────────────────────────────────────────
// 数字员工接口
// ─────────────────────────────────────────────
router.get('/apps/:appId/employees', verifyApiKey, getEmployees);
router.post('/apps/:appId/employees/chat', verifyApiKey, chatWithEmployee);

// ─────────────────────────────────────────────
// 会话历史
// ─────────────────────────────────────────────
router.get('/apps/:appId/conversations', verifyApiKey, listConversations);
router.get('/apps/:appId/conversations/:conversationId/messages', verifyApiKey, getConversationMessages);

export default router;
