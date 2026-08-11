// 中文注释: AI 相关路由聚合。目前仅包含 /chat，后续增加 /chart/recommend /query/preview 等。
import express from 'express';
import agentStreamController from '../controllers/agentStream.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// 添加日志中间件
// router.use((req, res, next) => {
//   logger.info({ method: req.method, path: req.path }, '[AI Routes] Request received');
//   logger.info({ headers: req.headers }, '[AI Routes] Headers');
//   logger.info({ body: req.body }, '[AI Routes] Body');
//   next();
// });

// 获取可用模型列表
router.get('/models', protect, agentStreamController.getAvailableModels);

// BlockNote AI generation
router.post('/blocknote/generate', protect, agentStreamController.unifiedStream);

router.post('/employ/:employeeId/generate', protect, agentStreamController.employeeStream);

// --- Memory Management ---
import * as memoryController from '../controllers/memory.controller.js';
// Agent's ai_memory documents (deep agent 的 agent.md)
router.get('/agent-memory/:appId/list', protect, memoryController.getAgentMemoryList);
router.get('/agent-memory/:appId/:docId', protect, memoryController.getAgentMemoryContent);

export default router;
