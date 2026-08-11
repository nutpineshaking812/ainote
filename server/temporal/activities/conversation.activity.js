import { ApplicationFailure } from '@temporalio/workflow';
import * as conversationService from '../../services/conversationService.js';
import { logger } from '../../config/logger.js';
import workflowEvents from '../../services/workflow.events.js';
import registryService from '../../services/workflow/registry.service.js';
import { formatToLocalTime } from '../../utils/time.js';
import { getToolDisplayMode } from '../../agent/tools/displayMode.js';

/**
 * 活动：确保会话存在
 * 职责：检查传入的 conversationId，如果不存在则创建新会话
 */
export const ensureConversation = async (params) => {
  const { conversationId, userId, appId, type, message, targetId, employeeId, scenario } = params;
  try {
    const { conversation, isNew } = await conversationService.ensureConversation(conversationId, {
      userId,
      appId,
      type,
      message,
      targetId,
      employeeId,
      scenario,
    });
    // Removed redundant emit - session info is broadcasted during addMessage
    // to include the assistantMessageId and avoid double output.

    logger.debug({ conversationId: conversation._id.toString() }, 'ensureConversation');
    return {
      conversationId: conversation._id.toString(),
      title: conversation.title,
      type: conversation.scenario,
      scenario: conversation.scenario,
      createdAt: conversation.createdAt ? new Date(conversation.createdAt).toISOString() : null,
      isNew,
    };
  } catch (err) {
    logger.error({ err, conversationId }, '[conversation.activity] ensureConversation failed');
    throw err;
  }
};

/**
 * 活动：记录消息 (统一持久化 Activity)
 * 职责：
 *  1. 向指定会话存入消息
 *  2. 支持原子地存入 "用户提问 + 助手占位" (通过 userContent 参数)
 *  3. 如果 role 为 assistant 且 openBubble=true，则通知 UI 开启回复气泡
 */
export const addMessage = async (params) => {
  const {
    conversationId,
    role = 'user',
    content,
    workflowId,
    openBubble = false, // Default changed to false for safety
    parentExecutionId,
    ...extra
  } = params;

  console.log('TRACE_AINOTE conversation.activity.addMessage called:', {
    conversationId,
    role,
    content,
    workflowId,
    openBubble,
    executionId: params.executionId || extra.executionId,
    extraKeys: Object.keys(extra),
  });

  logger.info(
    { conversationId, role, hasUserContent: !!content, openBubble, params },
    '[conversation.activity] addMessage (unified) called',
  );

  try {
    if (!conversationId) {
      throw ApplicationFailure.create({
        message: 'Missing conversationId for addMessage',
        type: 'ValidationError',
        nonRetryable: true,
      });
    }

    let msgId = null;

    // 1. Handle user content if provided
    if (content) {
      const userMsg = await conversationService.addMessage(conversationId, 'user', content, {
        segments: [{ type: 'user', content: content }],
      });
      msgId = userMsg.id;
    }

    // 2. Handle assistant bubble if requested
    // If openBubble is true, we always create an assistant placeholder (or a full assistant message if content is present)
    if (openBubble) {
      let msg = await conversationService.createAssistantMessage(conversationId, extra);
      msgId = msg.id;

      const conversation = await conversationService.getConversation(conversationId);
      const emitExecutionId = extra.executionId || params.executionId;
      console.log('TRACE_AINOTE conversation.activity.addMessage emitting session:ready:', {
        workflowId,
        conversationId,
        executionId: emitExecutionId,
        parentExecutionId,
        assistantMessageId: msgId,
        title: conversation?.title,
      });
      workflowEvents.emit('session:ready', {
        workflowId,
        conversationId,
        executionId: emitExecutionId,
        parentExecutionId,
        assistantMessageId: msgId,
        title: conversation?.title || '新对话信号',
      });
    }

    return {
      messageId: msgId,
    };
  } catch (err) {
    logger.error({ err, conversationId }, '[conversation.activity] addMessage failed');
    throw err;
  }
};

/**
 * 活动：获取已存在的助手消息 ID
 * 职责：根据 conversationId 查找是否已有气泡
 */
export const getAssistantMessageId = async (params) => {
  const { conversationId } = params;
  try {
    const messageId = await conversationService.findLatestAssistantMessageId(conversationId);
    return messageId;
  } catch (err) {
    logger.error({ err, conversationId }, '[conversation.activity] getAssistantMessageId failed');
    throw err;
  }
};

/**
 * 活动：准备对话环境（旧式聚合节点，保留兼容）
 */
export const prepareConversation = async (params) => {
  const { conversationId, userId, appId, type, message, workflowId, targetId, employeeId, scenario } = params;

  console.log('TRACE_AINOTE conversation.activity.prepareConversation called:', params);

  // 1. 确保会话存在
  const convo = await ensureConversation({ conversationId, userId, appId, type, message, targetId, employeeId, scenario });

  // 2. 一步完成：存入用户消息 + 存入助手占位 + 开启 UI 气泡
  const replyRes = await addMessage({
    conversationId: convo.conversationId,
    userContent: message,
    role: 'assistant',
    openBubble: true,
    workflowId,
    executionId: params.executionId,
  });

  return {
    ...convo,
    userMessageId: null, // 为了简化，这里不再单独返回用户消息 ID (如果业务需要可以再加)
    assistantMessageId: replyRes.messageId,
  };
};

/**
 * 活动：获取历史记录做为记忆
 */
export const fetchMemory = async (conversationId, options = {}) => {
  const { limit, afterTime } = options;
  console.log('fetchMemory', conversationId, limit, afterTime);
  try {
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation)
      return { messages: [], segments: [], count: 0, plainText: '', latestMessageTime: null };

    const messages = await conversationService.buildMemoryPayload(conversation, {
      limit: limit ? Number(limit) : undefined,
      afterTime,
    });

    // 构造便于 AI 和后续节点使用的纯文本格式
    const plainText = messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        const label = m.role === 'user' ? 'User' : 'Assistant';
        const text = conversationService.segmentsToPlainText([m]);
        return text ? `${label}: ${text}` : '';
      })
      .filter(Boolean)
      .join('\n');

    // 获取最新消息的时间 (messages 已按正序排列，最后一个是最新的)
    const latestMsg = messages.length > 0 ? messages[messages.length - 1] : null;

    return {
      messages, // 原始数组格式 (用于 LLM 调用)
      count: messages.filter((m) => m.role !== 'system').length, // 实际对话条数
      plainText, // 拼装后的纯文本 (用于提炼等)
      latestMessageTime: latestMsg ? new Date(latestMsg.createdAt).toISOString() : null,
    };
  } catch (err) {
    logger.error({ err, conversationId }, '[conversation.activity] fetchMemory failed');
    throw err;
  }
};

/**
 * 活动：获取知识做为记忆 ( loadMemory )
 * 与 fetchMemory 后端逻辑一致
 */
export const loadMemory = async (params) => {
  const { conversationId, limit, afterTime } = params || {};
  return await fetchMemory(conversationId, { limit, afterTime });
};

/**
 * 活动：持久化 AI 回复结果
 */
export const persistResponse = async (params) => {
  const {
    assistantMessageId,
    content,
    usage,
    chartData,
    thought,
    toolResult,
    toolCalls,
    stage,
    hidden = false,
  } = params;
  try {
    if (!assistantMessageId) return { success: false, message: 'Missing message ID' };

    const segments = [];

    // 0. Stage indicator (Visible progress step)
    if (stage) {
      segments.push({ type: 'stage', content: stage, hidden });
    }

    // 1. Thinking/Thought fragment
    if (thought) {
      segments.push({ type: 'thought', content: thought, hidden });
    }

    // 2. Tool Calls (Intent to call tools)
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      segments.push(
        ...toolCalls.map((tc) => ({
          type: 'tool_call',
          content: tc,
          hidden,
          meta: { displayMode: getToolDisplayMode(tc.name) },
        })),
      );
    }

    // 3. Tool Execution Result fragment
    if (toolResult) {
      const results = Array.isArray(toolResult) ? toolResult : [toolResult];
      segments.push(
        ...results.map((tr) => ({
          type: 'tool_output',
          content: tr,
          hidden,
        })),
      );
    }

    // 4. Assistant Text content (Final or Intermediate)
    if (content) {
      segments.push({ type: 'assistant', content: content, hidden });
    }

    // 5. Optional Analysis Chart Data
    if (chartData) {
      segments.push({ type: 'chart_data', content: chartData, hidden });
    }

    if (segments.length > 0) {
      logger.info(
        { assistantMessageId, segmentTypes: segments.map((s) => s.type), hidden },
        '[conversation.activity] Appending segments',
      );
      await conversationService.appendMessageSegments(assistantMessageId, segments);
    }

    // Update Token usage metadata
    if (usage && Object.keys(usage).length > 0) {
      await conversationService.updateMessageMetadata(assistantMessageId, {
        responseMetadata: { tokenUsage: usage },
      });
    }

    return { success: true, segmentCount: segments.length };
  } catch (err) {
    logger.error({ err, assistantMessageId }, '[conversation.activity] persistResponse failed');
    throw err;
  }
};
/**
 * 活动：获取系统工作流配置 (带 Shadowing 支持)
 */
export const getWorkflowConfig = async (name, appId) => {
  try {
    const workflow = await registryService.getWorkflowByKey(name, appId);
    if (!workflow) throw new Error(`Workflow config "${name}" not found.`);

    return {
      nodes: workflow.nodes,
      edges: workflow.edges,
    };
  } catch (err) {
    logger.error({ err, name, appId }, '[conversation.activity] getWorkflowConfig failed');
    throw err;
  }
};
