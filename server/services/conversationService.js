// 中文注释: 会话与消息持久化服务 (PostgreSQL 版)。
import ChatConversationRepository from '../repositories/chatConversation.repository.js';
import ChatMessageRepository from '../repositories/chatMessage.repository.js';
import { formatToLocalTime } from '../utils/time.js';
import { EMPLOYEE_SCENARIOS } from '../constants/digitalEmployee.js';

const WINDOW_LIMIT = 6; // 最近消息窗口大小

async function ensureConversation(
  conversationId,
  { userId = '', message = '默认名字', appId = null, targetId, employeeId, scenario = EMPLOYEE_SCENARIOS.GENERAL } = {},
) {
  let isNew = false;
  let conv;

  console.log('TRACE_AINOTE ensureConversation called:', {
    conversationId,
    userId,
    message,
    appId,
    targetId,
    employeeId,
    scenario,
  });

  if (conversationId && conversationId !== 'new') {
    conv = await ChatConversationRepository.findById(conversationId);
    if (conv) {
      console.log('TRACE_AINOTE ensureConversation found existing conversation:', {
        id: conv.id || conv._id,
        title: conv.title,
        employeeId: conv.employeeId,
        scenario: conv.scenario,
        targetId: conv.targetId,
      });

      // Update empty or general fields with new incoming data
      let needsUpdate = false;
      const updatePayload = {};

      if (employeeId && conv.employeeId !== employeeId) {
        updatePayload.employeeId = employeeId;
        needsUpdate = true;
      }
      if (scenario && scenario !== EMPLOYEE_SCENARIOS.GENERAL && conv.scenario !== scenario) {
        updatePayload.scenario = scenario;
        needsUpdate = true;
      }
      if (targetId && conv.targetId !== targetId) {
        updatePayload.targetId = targetId;
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log('TRACE_AINOTE ensureConversation updating existing conversation fields:', updatePayload);
        await ChatConversationRepository.update(conv.id || conv._id, updatePayload);
        conv = await ChatConversationRepository.findById(conversationId);
      }
    } else {
      console.log('TRACE_AINOTE ensureConversation conversation not found for ID:', conversationId);
    }
  }

  if (!conv) {
    isNew = true;
    let textContent = '';
    if (typeof message === 'string') {
      textContent = message;
    } else if (Array.isArray(message)) {
      const textItem = message.find((item) => item.type === 'text');
      textContent = textItem ? textItem.text : '';
    }
    const cleaned = (textContent || '').trim().replace(/\s+/g, ' ');
    const title = cleaned.length > 18 ? cleaned.slice(0, 18) : cleaned || '新对话';

    const resolvedScenario = scenario || EMPLOYEE_SCENARIOS.GENERAL;
    const payload = { userId, appId, title, targetId, employeeId, scenario: resolvedScenario };
    if (conversationId && conversationId !== 'new') {
      payload.id = conversationId;
    }

    console.log('TRACE_AINOTE ensureConversation creating new conversation. Payload:', payload);
    conv = await ChatConversationRepository.create(payload);
    console.log('TRACE_AINOTE ensureConversation created new conversation successfully:', {
      id: conv.id || conv._id,
      title: conv.title,
      employeeId: conv.employeeId,
      scenario: conv.scenario,
      targetId: conv.targetId,
    });
  }

  return { conversation: conv, isNew };
}

function deriveDefaultSegmentType(roleOrType = 'user') {
  const r = String(roleOrType).toLowerCase();

  // 1. If it's already a valid core segment type, keep it
  const validTypes = [
    'user',
    'assistant',
    'system',
    'thought',
    'tool_call',
    'tool_output',
    'chart_data',
    'stage',
    'image_url',
  ];
  if (validTypes.includes(r)) return r;

  // 2. Mapping from legacy roles or shorthand roles to normalized segment types
  switch (r) {
    case 'text':
      return 'user';
    case 'response':
      return 'assistant';
    case 'tool':
    case 'tools':
      return 'tool_output';
    case 'thinking':
      return 'thought';
    default:
      return 'user';
  }
}

function normalizeContentToSegments(content, type) {
  if (Array.isArray(content)) {
    return content.map((seg) => buildSegmentPayload(seg, type));
  }
  if (content === undefined || content === null) return [];
  const textValue = typeof content === 'string' ? content : JSON.stringify(content);
  return [buildSegmentPayload({ type: type, content: textValue })];
}

function segmentsToPlainText(segments = [], { includeCharts = false, fallback } = {}) {
  if (!Array.isArray(segments) || segments.length === 0) {
    if (fallback === undefined || fallback === null) return '';
    return typeof fallback === 'string' ? fallback : JSON.stringify(fallback);
  }
  const buffer = segments
    .map((seg) => {
      if (!seg) return '';
      if (seg.type === 'chart_data' && !includeCharts) return '';
      if (seg.type === 'thought' || seg.type === 'tool_call') return ''; // Usually hidden in plain text

      const value = seg.content ?? seg.text ?? seg.payload ?? null;
      if (seg.type === 'tool_output' && typeof value === 'object' && value !== null) {
        return value.result || JSON.stringify(value);
      }

      // 处理 content 为数组格式的情况（如 [{text: "...", type: "text"}]）
      if (Array.isArray(value)) {
        return value
          .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') return item.text ?? item.content ?? '';
            return '';
          })
          .join('');
      }

      if (typeof value === 'string') return value;
      if (value === undefined || value === null) return '';
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      try {
        return JSON.stringify(value);
      } catch (err) {
        return '';
      }
    })
    .filter(Boolean)
    .join('\n');

  if (buffer) return buffer;
  if (fallback === undefined || fallback === null) return '';
  return typeof fallback === 'string' ? fallback : JSON.stringify(fallback);
}

async function addMessage(conversationId, role, content, extra = {}) {
  const { segments: extraSegments, ...rest } = extra || {};
  const messageData = {
    conversationId,
    role: role || 'user',
    responseMetadata: rest.responseMetadata || rest.response_metadata || null,
  };

  const type = deriveDefaultSegmentType(role);

  let segments = [];
  if (Array.isArray(extraSegments) && extraSegments.length) {
    segments = extraSegments.map((seg) => buildSegmentPayload(seg, type));
  } else if (role === 'tool' && (rest.toolCallId || rest.tool_call_id)) {
    segments.push({
      type: 'tool_output',
      content: {
        toolCallId: rest.toolCallId || rest.tool_call_id,
        result: content,
      },
    });
  } else if (content !== undefined && content !== null) {
    segments = normalizeContentToSegments(content, type);
  }

  // Handle assistant tool_calls intent
  const toolCalls = rest.tool_calls || rest.toolCalls;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    segments.push(...toolCalls.map((tc) => ({ type: 'tool_call', content: tc })));
  }

  return ChatMessageRepository.createWithSegments(messageData, segments);
}

async function createAssistantMessage(conversationId, extra = {}) {
  const { segments: extraSegments, ...rest } = extra || {};
  const messageData = {
    conversationId,
    role: 'assistant',
    responseMetadata: rest.responseMetadata || rest.response_metadata || null,
  };

  const segments =
    Array.isArray(extraSegments) && extraSegments.length
      ? extraSegments.map((seg) => buildSegmentPayload(seg, 'assistant'))
      : [];

  const toolCalls = rest.tool_calls || rest.toolCalls;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    segments.push(...toolCalls.map((tc) => ({ type: 'tool_call', content: tc })));
  }

  return ChatMessageRepository.createWithSegments(messageData, segments);
}

function buildSegmentPayload(segment = {}, role = 'user') {
  let content = segment.content ?? segment.text ?? segment.payload ?? null;
  if (content === null && segment.image_url) {
    content = segment.image_url;
  }
  return {
    type: segment.type || deriveDefaultSegmentType(role),
    content,
    createdAt: segment.createdAt || new Date(),
    hidden: segment.hidden === true,
    meta: segment.meta || null,
  };
}

async function appendMessageSegment(messageId, segmentInput = {}) {
  if (!messageId) throw new Error('messageId is required to append segment');
  const segment = buildSegmentPayload(segmentInput);
  return ChatMessageRepository.appendSegment(messageId, segment.type, segment.content, segment.hidden, segment.meta);
}

async function appendMessageSegments(messageId, segmentsInput = []) {
  if (!messageId) throw new Error('messageId is required to append segments');
  if (!Array.isArray(segmentsInput) || segmentsInput.length === 0) return [];
  const segments = segmentsInput.map((seg) => buildSegmentPayload(seg));
  return ChatMessageRepository.appendSegments(messageId, segments);
}

async function updateMessageMetadata(messageId, updates = {}) {
  if (!messageId) throw new Error('messageId is required to update metadata');
  const mappedUpdates = { ...updates };
  if (updates.response_metadata) {
    mappedUpdates.responseMetadata = updates.response_metadata;
    delete mappedUpdates.response_metadata;
  }
  return ChatMessageRepository.update(messageId, mappedUpdates);
}

async function getRecentMessages(conversationId, options = {}) {
  const { limit = WINDOW_LIMIT, afterTime } = options;
  return ChatMessageRepository.findRecentWithSegments(conversationId, limit, {
    afterTime,
    includeHidden: false,
  });
}

async function buildMemoryPayload(conversation, options = {}) {
  if (!conversation) return [];
  const limit = options.limit || 50;
  const afterTime = options.afterTime || null;
  const conversationId = conversation.id || conversation._id;

  const segments = await ChatMessageRepository.findLatestSegmentsJoined(conversationId, limit, {
    afterTime,
    excludeTypes: ['stage'], // 默认排除进度片段，不作为 AI 记忆
  });
  return segments.reverse();
}

async function getConversation(id) {
  if (!id) return null;
  return ChatConversationRepository.findById(id);
}

async function findLatestAssistantMessageId(conversationId) {
  if (!conversationId) return null;
  const msg = await ChatMessageRepository.findOne({
    where: (table, { eq, and, or }) =>
      and(eq(table.conversationId, conversationId), eq(table.role, 'assistant')),
    order: (table, { desc }) => [desc(table.createdAt)],
  });
  return msg ? msg.id : null;
}

export {
  ensureConversation,
  getConversation,
  addMessage,
  createAssistantMessage,
  appendMessageSegment,
  appendMessageSegments,
  updateMessageMetadata,
  getRecentMessages,
  buildMemoryPayload,
  segmentsToPlainText,
  findLatestAssistantMessageId,
};
