import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { DefaultChatProvider, useXChat, XRequest } from '@ant-design/x-sdk';
import api, { API_URL, getCommonHeaders } from '../../../api/index';
import { message } from 'antd';
import { transformSegmentsToParts } from '../utils/messageTransformer';
import { EMPLOYEE_SCENARIOS } from '../../../constants/employee';
import resourceEventBus from '../../../pages/app-detail/utils/resourceEventBus';

const randomId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const ensureAssistantMessage = (msg) => {
  if (msg && msg.role === 'assistant') return msg;
  return {
    id: msg?.id || randomId('assistant'),
    role: 'assistant',
    segments: [],
    status: 'loading',
    createdAt: msg?.createdAt || Date.now(),
  };
};

/**
 * 智能更新片段：支持根据类型自动决定是追加还是新建，以保证时序正确
 */
const upsertSegmentByOrder = (msg, type, delta = '', options = {}) => {
  const base = ensureAssistantMessage(msg);
  const segments = Array.isArray(base.segments) ? [...base.segments] : [];
  const lastSeg = segments[segments.length - 1];

  const isFinished = options.isFinished || false;
  const forceKey = options.key;
  const extraFields = options.extraFields || {};

  // If a forceKey is provided, this segment represents a specific, identifiable entity
  // (e.g. a tool call with a unique toolCallId). Try to find and update it by key first.
  if (forceKey) {
    const index = segments.findIndex((s) => s.id === forceKey);
    if (index > -1) {
      const target = {
        ...segments[index],
        ...extraFields,
      };
      if (delta) target.text = (target.text || '') + delta;
      if (isFinished) target.status = 'success';
      segments[index] = target;
      return { ...base, segments };
    }
    // Key not found: this is a brand-new entity (e.g. a parallel tool call B arriving after A).
    // Append it directly without touching other segments – no cleanup, no overwrite.
    segments.push({
      id: forceKey,
      type,
      text: delta,
      status: isFinished ? 'success' : 'loading',
      ...extraFields,
    });
    return { ...base, segments };
  }

  if (lastSeg && lastSeg.type === type && lastSeg.status !== 'success') {
    const updatedLast = {
      ...lastSeg,
      ...extraFields,
    };
    if (delta) updatedLast.text = (updatedLast.text || '') + delta;
    if (isFinished) updatedLast.status = 'success';
    segments[segments.length - 1] = updatedLast;
    return { ...base, segments };
  }

  const cleanedSegments = segments.map((s) =>
    s.status === 'loading' ? { ...s, status: 'success' } : s,
  );
  cleanedSegments.push({
    id: forceKey || randomId(`seg-${type}`),
    type,
    text: delta,
    status: isFinished ? 'success' : 'loading',
    ...extraFields,
  });

  return { ...base, segments: cleanedSegments };
};

const safeJsonParse = (value) => {
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (err) {
    console.warn('SSE payload parse failed', err);
    return null;
  }
};

class UnifiedAgentChatProvider extends DefaultChatProvider {
  constructor(config) {
    super({ request: config.request });
    this.onServerEvent = config.onServerEvent;
    // 用于多对话隔离：通过 ref 读取最新值，避免闭包陈旧问题
    this._conversationIdRef = config.conversationIdRef;
    this._streamKeyRef = config.streamKeyRef;
    // 员工 ID：多员工 dock 场景下标识当前说话的员工
    this._employeeIdRef = config.employeeIdRef;
  }

  transformLocalMessage(requestParams) {
    const msgVal = requestParams?.message || requestParams?.content;
    if (!msgVal) return null;
    return {
      id: randomId('user'),
      role: 'user',
      segments: [{ type: 'user', text: msgVal, status: 'success' }],
      createdAt: Date.now(),
    };
  }

  transformMessage(info) {
    const { chunk, originMessage } = info;
    const dataText = chunk.data?.trim();
    // console.log('[Unified·transformMessage] Received chunk:', dataText);

    if (!chunk || dataText === '[DONE]' || !chunk.data) {
      if (dataText === '[DONE]' && originMessage?.status === 'loading') {
        const segments = (originMessage.segments || []).map((s) => ({ ...s, status: 'success' }));
        return { ...originMessage, status: 'success', segments };
      }
      return originMessage;
    }

    const payload = safeJsonParse(chunk.data);
    if (!payload) return originMessage;

    const eventType = payload.type;
    let msg = ensureAssistantMessage(originMessage);

    if (eventType === 'data-conversation' || eventType === 'conversation') {
      const data = payload.data || payload;
      if (typeof this.onServerEvent === 'function') this.onServerEvent(eventType, data);
      if (data.messageId) msg.id = data.messageId;
      return msg;
    }

    const handleEvent = (type, data, prevMsg) => {
      if (type && typeof this.onServerEvent === 'function') {
        this.onServerEvent(type, data.data || data);
      }

      // 将每一个 SSE 事件发射到 resourceEventBus，供 SDK 事件桥接
      // 宿主页面通过 AiNoteChat.events.on('stream:event', ...) 监听所有对话实时数据
      // streamKey: 外部传入的 dock 唯一标识，代表数字员工来自哪个 dock（多 dock 场景下区分数据来源）
      // conversationId: 后端返回的真实会话 ID（首轮 SSE 事件中可能为 null）
      // employeeId: 当前数字员工的 ID（多员工 dock 场景下区分不同员工的事件流）
      resourceEventBus.emit('stream:event', {
        type,
        data: data.data || data,
        streamKey: this._streamKeyRef?.current,
        conversationId: this._conversationIdRef?.current,
        employeeId: this._employeeIdRef?.current,
      });

      switch (type) {
        case 'text-delta': {
          const text = data.textDelta || data.content || data.delta || '';
          return upsertSegmentByOrder(prevMsg, 'text', text);
        }

        case 'thinking-delta': {
          const text = data.textDelta || data.content || data.delta || '';
          return upsertSegmentByOrder(prevMsg, 'thought', text);
        }

        case 'stage':
        case 'node:progress': {
          const isStage = type === 'stage' || data.status === 'stage';
          if (!isStage) return prevMsg;
          const key = data.nodeId || data.toolCallId || 'current-stage';
          const text = data.content || data.text || '';
          return upsertSegmentByOrder(prevMsg, 'stage', text, { key });
        }

        case 'tool-input-start': {
          const key = data.toolCallId || data.nodeId || 'tool-execution';
          return upsertSegmentByOrder(prevMsg, 'tool_call', '', {
            key,
            extraFields: { toolName: data.toolName },
          });
        }

        case 'tool-input-delta': {
          const key = data.toolCallId || data.nodeId || 'tool-execution';
          const delta = data.inputTextDelta || '';
          return upsertSegmentByOrder(prevMsg, 'tool_call', delta, {
            key,
            extraFields: { toolName: data.name || data.toolName },
          });
        }

        case 'tool-input-available': {
          const key = data.toolCallId || data.nodeId || 'tool-execution';
          return upsertSegmentByOrder(prevMsg, 'tool_call', '', {
            key,
            isFinished: true,
            extraFields: {
              toolName: data.toolName,
              input: data.input,
            },
          });
        }

        case 'tool-result':
        case 'tool-output-available': {
          const key = (data.toolCallId || data.nodeId || 'tool-execution') + '-result';
          const result = data.output || data.result;
          return upsertSegmentByOrder(prevMsg, 'tool_output', result, { key, isFinished: true });
        }

        case 'finish': {
          const segments = (prevMsg.segments || []).map((s) => ({ ...s, status: 'success' }));
          return { ...prevMsg, status: 'success', segments };
        }

        case 'error': {
          const text = data.error || data.message || 'Unknown error';
          return upsertSegmentByOrder(prevMsg, 'error', `\n\n> ❌ 错误: ${text}`, {
            isFinished: true,
          });
        }

        case 'chart':
        case 'data': {
          const innerData = data.data || data;
          if (Array.isArray(innerData)) {
            let tempMsg = prevMsg;
            innerData.forEach((item) => {
              tempMsg = handleEvent(item.type, item, tempMsg);
            });
            return tempMsg;
          }
          if (innerData.type === 'chart' || innerData.chartType) {
            const segmentId = data.segmentId || data.id || innerData.segmentId;
            return upsertSegmentByOrder(prevMsg, 'chart_data', innerData.data || innerData, {
              isFinished: true,
              key: segmentId,
              extraFields: {
                segmentId: segmentId,
              },
            });
          }
          return prevMsg;
        }

        default:
          return prevMsg;
      }
    };

    return handleEvent(eventType, payload, msg);
  }
}

class AgentChatProvider extends DefaultChatProvider {
  constructor(config) {
    super({ request: config.request });
    this.onServerEvent = config.onServerEvent;
  }

  transformLocalMessage(requestParams) {
    const msgVal = requestParams?.message || requestParams?.content;
    if (!msgVal) return null;
    return {
      id: randomId('user'),
      role: 'user',
      segments: [{ type: 'text', text: msgVal, status: 'success' }],
      createdAt: Date.now(),
    };
  }

  transformMessage(info) {
    const { chunk, originMessage } = info;
    const dataText = chunk.data?.trim();

    if (!chunk || dataText === '[DONE]' || !chunk.data) {
      if (
        dataText === '[DONE]' &&
        (originMessage?.status === 'loading' || !originMessage?.status)
      ) {
        const segments = (originMessage?.segments || []).map((s) => ({ ...s, status: 'success' }));
        return { ...originMessage, status: 'success', segments };
      }
      return originMessage;
    }

    const payload = safeJsonParse(chunk.data);
    if (!payload) return originMessage;

    const eventType = payload.type;
    let msg = ensureAssistantMessage(originMessage);

    if (eventType === 'data-conversation' || eventType === 'conversation') {
      const data = payload.data || payload;
      if (typeof this.onServerEvent === 'function') this.onServerEvent(eventType, data);
      if (data.messageId) msg.id = data.messageId;
      return msg;
    }

    const handleEvent = (type, data, prevMsg) => {
      if (type && typeof this.onServerEvent === 'function') {
        this.onServerEvent(type, data.data || data);
      }

      switch (type) {
        case 'text-delta': {
          const text = data.textDelta || data.content || data.delta || '';
          return upsertSegmentByOrder(prevMsg, 'text', text);
        }

        case 'thinking-delta': {
          const text = data.textDelta || data.content || data.delta || '';
          return upsertSegmentByOrder(prevMsg, 'thought', text);
        }

        case 'stage':
        case 'node:progress': {
          const isStage = type === 'stage' || data.status === 'stage';
          if (!isStage) return prevMsg;
          const key = data.nodeId || data.toolCallId || 'current-stage';
          const text = data.content || data.text || '';
          return upsertSegmentByOrder(prevMsg, 'stage', text, { key });
        }

        case 'tool-input-start': {
          const key = data.toolCallId || data.nodeId || 'tool-execution';
          return upsertSegmentByOrder(prevMsg, 'tool_call', '', {
            key,
            extraFields: { toolName: data.toolName },
          });
        }

        case 'tool-input-delta': {
          const key = data.toolCallId || data.nodeId || 'tool-execution';
          const delta = data.inputTextDelta || '';
          return upsertSegmentByOrder(prevMsg, 'tool_call', delta, {
            key,
            extraFields: { toolName: data.name || data.toolName },
          });
        }

        case 'tool-input-available': {
          const key = data.toolCallId || data.nodeId || 'tool-execution';
          return upsertSegmentByOrder(prevMsg, 'tool_call', '', {
            key,
            isFinished: true,
            extraFields: {
              toolName: data.toolName,
              input: data.input,
            },
          });
        }

        case 'tool-result':
        case 'tool-output-available': {
          const key = (data.toolCallId || data.nodeId || 'tool-execution') + '-result';
          const result = data.output || data.result;
          return upsertSegmentByOrder(prevMsg, 'tool_output', result, { key, isFinished: true });
        }

        case 'finish': {
          const segments = (prevMsg.segments || []).map((s) => ({ ...s, status: 'success' }));
          return { ...prevMsg, status: 'success', segments };
        }

        case 'error': {
          const text = data.error || data.message || 'Unknown error';
          return upsertSegmentByOrder(prevMsg, 'error', `\n\n> ❌ 错误: ${text}`, {
            isFinished: true,
          });
        }

        case 'chart':
        case 'data': {
          const innerData = data.data || data;
          if (Array.isArray(innerData)) {
            let tempMsg = prevMsg;
            innerData.forEach((item) => {
              tempMsg = handleEvent(item.type, item, tempMsg);
            });
            return tempMsg;
          }
          if (innerData.type === 'chart' || innerData.chartType) {
            const segmentId = data.segmentId || data.id || innerData.segmentId;
            return upsertSegmentByOrder(prevMsg, 'chart_data', innerData.data || innerData, {
              isFinished: true,
              key: segmentId,
              extraFields: {
                segmentId: segmentId,
              },
            });
          }
          return prevMsg;
        }

        default:
          return prevMsg;
      }
    };

    return handleEvent(eventType, payload, msg);
  }
}

export function useXAgentChat(requestPath, options = {}) {
  // SDK 场景下 baseURL 会被动态改写，使用 api.defaults.baseURL 确保 SSE 请求也走正确域名
  const baseURL = api.defaults.baseURL || API_URL;
  const url = options.url || `${baseURL}${requestPath}`;
  const [conversationId, setConversationId] = useState(options.conversationId || null);
  // 供 UnifiedAgentChatProvider 读取最新 conversationId，实现多对话事件隔离
  const conversationIdRef = useRef(options.conversationId || null);
  // streamKey：宿主页面传入的 dock 唯一标识，代表数字员工来自哪个 dock
  // 宿主页面通过 stream:event 回调中的 streamKey + employeeId 做双重过滤
  const streamKeyRef = useRef(options.streamKey);
  streamKeyRef.current = options.streamKey;
  const employeeIdRef = useRef(options.employeeId);
  employeeIdRef.current = options.employeeId;
  const toolCallDocIdRef = useRef({});
  const toolCallNameRef = useRef({});
  const toolCallAccumulatedRef = useRef({});

  // console.log('%c[useXAgentChat·DIAG] 初始化/重渲染', 'color:#10b981;font-weight:bold', {
  //   requestPath,
  //   url,
  //   optionsConversationId: options.conversationId,
  //   optionsConversationKey: options.conversationKey,
  //   stateConversationId: options.conversationId || null,
  // });

  useEffect(() => {
    console.log('Conversation ID changed:', options.conversationId);
    setConversationId(options.conversationId || null);
  }, [options.conversationId]);

  // 保持 conversationIdRef 与 state 同步，供 UnifiedAgentChatProvider 实时读取
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const handleServerEvent = useCallback(
    (event, payload) => {
      if (event === 'data-conversation' || event === 'conversation') {
        const data = payload?.conversationId || payload?.id ? payload : payload?.data;
        // console.log('%c[useXAgentChat·DIAG] handleServerEvent: 会话事件', 'color:#10b981;font-weight:bold', {
        //   event,
        //   oldConversationId: conversationId,
        //   newConversationId: data?.conversationId || data?.id,
        // });
        if (data?.conversationId || data?.id) setConversationId(data.conversationId || data.id);
      } else if (
        event === 'tool-input-start' ||
        event === 'tool-input-delta' ||
        event === 'tool-input-available' ||
        event === 'tool-result' ||
        event === 'tool-output-available'
      ) {
        const data = payload?.data || payload;
        const toolCallId = data?.toolCallId || data?.id;
        
        // Cache toolName when it is available in payload
        if (data?.toolName && toolCallId) {
          toolCallNameRef.current[toolCallId] = data.toolName;
        }

        const tName = data?.toolName || data?.name || (toolCallId ? toolCallNameRef.current[toolCallId] : null);
        if (
          tName === 'blocknote_add' ||
          tName === 'blocknote_update' ||
          tName === 'blocknote_delete'
        ) {
          const standardToolName = tName.replace('blocknote_', '');

          const parsedResult = safeJsonParse(
            data?.result || data?.output || data?.input || data?.args,
          );
          const parsedData = {
            ...data,
            result: parsedResult || data?.result,
            output: parsedResult || data?.output,
            input: parsedResult || data?.input,
            args: safeJsonParse(data?.args) || data?.args,
          };

          // Enforce active workspace docId first to prevent AI parameter hallucination, fallback to tool fields if options.docId is empty
          let docId =
            options.docId ||
            parsedData?.args?.docId ||
            parsedData?.input?.docId ||
            parsedData?.result?.docId ||
            parsedData?.output?.docId ||
            parsedData?.docId;

          // For delta events: accumulate chunk strings and try regex extraction from cumulative string
          if (!docId && parsedData?.inputTextDelta && toolCallId) {
            toolCallAccumulatedRef.current[toolCallId] = (toolCallAccumulatedRef.current[toolCallId] || '') + parsedData.inputTextDelta;
            const m = toolCallAccumulatedRef.current[toolCallId].match(/"docId"\s*:\s*"([^"]+)"/);
            if (m) {
              docId = m[1];
            }
          }

          // Cache the docId once known, look up from cache when still unknown
          if (docId && toolCallId) {
            toolCallDocIdRef.current[toolCallId] = docId;
          } else if (!docId && toolCallId) {
            docId = toolCallDocIdRef.current[toolCallId] || options.docId;
          }

          // Cleanup cache on final events
          if ((event === 'tool-result' || event === 'tool-output-available') && toolCallId) {
            setTimeout(() => {
              delete toolCallDocIdRef.current[toolCallId];
              delete toolCallNameRef.current[toolCallId];
              delete toolCallAccumulatedRef.current[toolCallId];
            }, 100);
          }

          resourceEventBus.emit('blocknote:stream-action', {
            docId,
            event,
            payload: {
              toolName: standardToolName,
              toolCallId: parsedData?.toolCallId,
              input:
                parsedData?.result ||
                parsedData?.output ||
                parsedData?.input ||
                parsedData?.args ||
                parsedData,
              inputTextDelta: parsedData?.inputTextDelta,
            },
          });
        }
      }
    },
    [conversationId],
  );

  const provider = useMemo(() => {
    return new UnifiedAgentChatProvider({
      request: (item) => {
        const { messages: sdkMessages, ...payload } = item || {};
        const req = XRequest(url, {
          manual: true,
          method: 'POST',
          headers: getCommonHeaders(),
          body: JSON.stringify(payload),
        });
        const originalAbort = req.abort.bind(req);
        req.abort = () => {
          try {
            originalAbort();
          } catch (e) {
            console.warn('XRequest abort failed (safe caught)', e);
          }
        };
        return req;
      },
      onServerEvent: handleServerEvent,
      conversationIdRef,
      streamKeyRef,
      employeeIdRef,
    });
  }, [url, handleServerEvent]);

  const {
    onRequest,
    messages: agentEntries,
    setMessages: setAgentEntries,
    abort,
    isRequesting,
  } = useXChat({
    provider,
    conversationKey: options.conversationKey || conversationId || 'active-chat',
  });

  // console.log('%c[useXAgentChat·DIAG] useXChat 绑定', 'color:#10b981;font-weight:bold', {
  //   agentEntriesLength: agentEntries?.length,
  //   isRequesting,
  //   conversationId,
  // });

  const messages = useMemo(() => {
    // console.log('%c[useXAgentChat·DIAG] 消息状态', 'color:#10b981;font-weight:bold', {
    //   agentEntriesLength: agentEntries?.length,
    //   isRequesting,
    // });
    return (agentEntries || [])
      .map((entry, idx) => {
        const msg = entry.message;
        if (!msg) return null;
        const isLatestAssistant = entry.role === 'assistant' && idx === agentEntries.length - 1;

        let statusForParts =
          isLatestAssistant && isRequesting ? 'loading' : msg.status || entry.status || 'success';
        if (!isRequesting && statusForParts === 'loading') {
          statusForParts = 'success';
        }

        const parts = transformSegmentsToParts(msg.segments, {
          messageId: msg.id || entry.id,
          status: statusForParts,
        });
        return { ...msg, id: msg.id || entry.id, status: entry.status, parts };
      })
      .filter((m) => m && m.parts && m.parts.length > 0);
  }, [agentEntries, isRequesting]);

  const startStream = useCallback(
    (text, extras = {}) => {
      const { type, scenario, data, inputs, conversation_id, conversationId: convId, ...rest } = extras;
      // streamKey 由外部宿主页面传入作为 dock 标识，每次对话回合保持不变
      onRequest({
        content: text,
        scenario: options.type || scenario || type,
        appId: options.appId,
        conversationId: conversationId || convId || conversation_id,
        inputs: inputs || data || {},
        ...rest,
      });
    },
    [conversationId, options.type, options.appId, onRequest],
  );

  const clearMessages = useCallback(() => {
    setAgentEntries([]);
  }, [setAgentEntries]);

  return {
    conversationId,
    setConversationId,
    messages,
    loading: isRequesting,
    startStream,
    clearMessages,
    abort,
  };
}

export default useXAgentChat;
