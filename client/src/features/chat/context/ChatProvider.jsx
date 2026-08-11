import React, { createContext, useContext, useMemo, useEffect } from 'react';
import useConversationHistory from './useConversationHistory.js';
import { useXAgentChat } from './useXAgentChat.js';
import { AgentDockContext } from './AgentDockContext.jsx';
import resourceEventBus from '../../../pages/app-detail/utils/resourceEventBus.js';

// ChatContext provides conversation threads, active thread key, messages (merged), and send capabilities.
const ChatContext = createContext(null);

export function ChatProvider({
  dataProvider,         // DataProvider 对象（策略模式），统一封装 requestPath / loadThreads / loadMessages
  placeholderKey = 'thread-placeholder',
  scenario = null,
  appId = null,
  enabled = true,
  extraParams = {},     // New prop for injecting global context
  children,
}) {
  const history = useConversationHistory({
    initialPlaceholderKey: placeholderKey,
    dataProvider,
    enabled,
  });

  const {
    activeKey: activeThreadKey,
    messagesMap,
    appendMessageToKey,
    applyRealConversationInfo,
    setActiveKey,
  } = history;

  const dockCtx = useContext(AgentDockContext);

  const {
    messages: streamMessages,
    startStream,
    loading: streamLoading,
    conversationId,
    setConversationId,
    clearMessages,
    abort,
  } = useXAgentChat(`${dataProvider?.requestPath || ''}`, {
    conversationId: activeThreadKey === placeholderKey ? null : activeThreadKey,
    conversationKey: activeThreadKey,
    type: scenario,
    appId,
    docId: extraParams?.data?.targetId,
    employeeId: dockCtx?.activeEmployee?.id || dockCtx?.activeEmployee?._id,
    streamKey: dockCtx?.streamKey,
  });

  // [DIAG] 会话状态快照
  // useEffect(() => {
  //   const baseMsgCount = (messagesMap[activeThreadKey] || []).length;
  //   console.log(
  //     '%c[ChatProvider·DIAG] 状态快照',
  //     'color:#6366f1;font-weight:bold',
  //     {
  //       placeholderKey,
  //       activeThreadKey,
  //       isPlaceholder: activeThreadKey === placeholderKey,
  //       conversationId,
  //       streamLoading,
  //       baseMsgCount,
  //       streamMsgCount: streamMessages.length,
  //       messagesMapKeys: Object.keys(messagesMap),
  //     },
  //   );
  // }, [placeholderKey, activeThreadKey, conversationId, streamLoading, streamMessages.length, messagesMap]);

  // Optimistically show user's message before streaming starts
  const startStreamOptimistic = (text, metadata) => {
    // console.log('Starting stream with text:', text, 'and metadata:', metadata);
    startStream(text, { ...extraParams, ...metadata });
  };

  // Merge streaming messages with base messages safely (avoid duplicates)
  const mergedMessages = useMemo(() => {
    const base = messagesMap[activeThreadKey] || [];
    if (!streamMessages.length) return base;

    // Filter out messages that are already in base to prevent duplicate keys
    const baseIds = new Set(base.map((m) => m.id));
    const nextStream = streamMessages.filter((m) => !baseIds.has(m.id));

    return [...base, ...nextStream];
  }, [activeThreadKey, messagesMap, streamMessages]);

  // When stream ends, persist messages to history and CLEAR stream state
  useEffect(() => {
    if (!streamLoading && streamMessages.length && conversationId) {
      // console.log('[ChatProvider] Persisting stream messages to history:', streamMessages.length);

      // 提取完整回复文本（供 SDK 事件使用）
      const fullText = streamMessages
        .filter((m) => m.role === 'assistant')
        .map((m) => (m.parts || []).map((p) => p.text || '').join(''))
        .join('');

      streamMessages.forEach((m) => {
        // 关键修复：持久化到历史时，将所有片段状态统一置为 success
        // 否则历史记录中最后一条片段将永远带有"正在输入"的光标
        const finalizedParts = (m.parts || []).map((p) => ({
          ...p,
          status: 'success',
        }));

        appendMessageToKey(conversationId, {
          id: m.id || `${m.role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: m.role,
          status: 'success',
          parts: finalizedParts,
          createdAt: m.createdAt || Date.now(),
        });
      });

      // Crucial: Clear stream so it doesn't double-render
      clearMessages();

      if (activeThreadKey === placeholderKey) {
        setActiveKey(conversationId);
      }

      // 通知外部：流式回复完成（供 SDK 事件桥接使用）
      resourceEventBus.emit('chat:stream:done', {
        conversationId,
        fullText,
        messageCount: streamMessages.length,
      });
    }
  }, [
    streamLoading,
    streamMessages,
    conversationId,
    appendMessageToKey,
    setActiveKey,
    activeThreadKey,
    placeholderKey,
    clearMessages,
  ]);

  // Apply real conversation info when backend assigns id
  useEffect(() => {
    if (conversationId) applyRealConversationInfo(conversationId);
  }, [conversationId, applyRealConversationInfo]);

  // Listen for external workflow triggers (e.g. from DocumentPublishMenu)
  useEffect(() => {
    const handleTrigger = (params) => {
      const { workflowId, userPrompt, payload } = params;
      if (!workflowId) return;

      // console.log('[ChatProvider] External workflow trigger received:', params);

      // Auto-start the stream
      startStreamOptimistic(userPrompt || `Executing workflow: ${workflowId}`, {
        workflowId,
        data: payload,
      });
    };

    const importKey = 'chat:trigger-workflow';
    resourceEventBus.on(importKey, handleTrigger);

    const handleSendMessage = (params) => {
      const { message: msgText, metadata } = params;
      if (!msgText) return;
      startStreamOptimistic(msgText, metadata || {});
    };
    resourceEventBus.on('chat:send-message', handleSendMessage);

    return () => {
      resourceEventBus.off(importKey, handleTrigger);
      resourceEventBus.off('chat:send-message', handleSendMessage);
    };
  }, [placeholderKey, setActiveKey, startStreamOptimistic]);

  const value = {
    ...history,
    streamLoading,
    startStream: startStreamOptimistic,
    mergedMessages,
    conversationId,
    setConversationId,
    hasHistory: !!dataProvider?.loadThreads,
    abort,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}

export default ChatProvider;
