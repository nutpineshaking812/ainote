import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { listConversations, getConversationMessages, updateConversationTitle } from '../controllers/conversation.controller.js';

const router = express.Router();

// 会话列表（按应用）
router.get('/apps/:appId/', protect, listConversations);
// 指定会话消息
router.get('/:conversationId/messages', protect, getConversationMessages);
// 更新标题
router.post('/:conversationId/title', protect, updateConversationTitle);

export default router;