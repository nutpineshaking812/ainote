import asyncHandler from 'express-async-handler';
import ChatConversationRepository from '../repositories/chatConversation.repository.js';
import ChatMessageRepository from '../repositories/chatMessage.repository.js';

// 列出指定应用下的会话历史（分页）
export const listConversations = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { page = 1, limit = 20, targetId, employeeId, scenario } = req.query;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: '未认证用户' });

  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  // Note: For simplicity in migration, we use the userId and appId from request.
  // In a real refined repo, we'd add pagination to the repository method.
  const items = await ChatConversationRepository.findByUserAndApp(userId, appId, {
    limit: l,
    targetId,
    employeeId,
    scenario,
  });
  const total = items.length; // Placeholder for total count if pagination is fully implemented

  const data = items.map(c => ({
    id: c.id,
    title: c.title || c.id,
    scenario: c.scenario,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: 0, // Placeholder
  }));

  return res.json({ success: true, data: { items: data, page: p, limit: l, total } });
});

// 获取指定会话的全部消息（或限制条数）
export const getConversationMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { limit } = req.query;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: '未认证用户' });
  if (!conversationId) {
    return res.status(400).json({ success: false, error: 'conversationId 必填' });
  }

  const convo = await ChatConversationRepository.findById(conversationId);
  if (!convo || convo.userId !== userId) {
    return res.status(404).json({ success: false, error: '会话不存在或无权限' });
  }

  const lim = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200) : 50;
  const msgs = await ChatMessageRepository.findRecentWithSegments(conversationId, lim);
  
  const data = msgs.map((m) => {
    // 收集 toolCallId → displayMode 映射
    const displayModeMap = {};
    m.segments.forEach(seg => {
      if (seg.type === 'tool_call' && seg.meta?.displayMode && seg.content?.id) {
        displayModeMap[seg.content.id] = seg.meta.displayMode;
      }
    });

    return {
      id: m.id,
      role: m.role,
      segments: m.segments.reduce((acc, seg) => {
        let content = seg.content;

        if (seg.type === 'tool_call') {
          const dm = seg.meta?.displayMode;
          // compact / name-only：去除参数
          if ((dm === 'compact' || dm === 'name-only') && content && typeof content === 'object') {
            content = { ...content, args: undefined };
          }
        }

        if (seg.type === 'tool_output') {
          const tcId = content?.toolCallId;
          // name-only：不返回工具结果，与实时 streaming 行为一致
          if (tcId && displayModeMap[tcId] === 'name-only') {
            return acc;
          }
        }

        acc.push({
          segmentId: seg.id,
          id: seg.id,
          type: seg.type,
          text: content,
          createdAt: seg.createdAt,
        });
        return acc;
      }, []),
      createdAt: m.createdAt,
    };
  });

  return res.json({ success: true, data: { conversation: { id: convo.id, scenario: convo.scenario }, messages: data } });
});

// 更新会话标题（仅允许当前用户的会话）
export const updateConversationTitle = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { title } = req.body || {};
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: '未认证用户' });
  if (!conversationId) {
    return res.status(400).json({ success: false, error: 'conversationId 必填' });
  }
  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, error: '标题不能为空' });
  }

  const convo = await ChatConversationRepository.findById(conversationId);
  if (!convo || convo.userId !== userId) {
    return res.status(404).json({ success: false, error: '会话不存在或无权限' });
  }

  const updated = await ChatConversationRepository.updateTitle(conversationId, title.trim().slice(0, 100));
  return res.json({ success: true, data: { id: updated.id, title: updated.title } });
});

export default { listConversations, getConversationMessages, updateConversationTitle };