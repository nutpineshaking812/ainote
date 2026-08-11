import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useXConversations } from '@ant-design/x-sdk';
import { PieChartOutlined } from '@ant-design/icons';

const buildThreadMeta = (item) => ({
  key: item.id,
  label: item.title?.slice(0, 18) || item.id,
  timestamp: new Date(item.updatedAt).getTime(),
  icon: React.createElement(PieChartOutlined),
  group: new Date(item.updatedAt).toLocaleDateString(),
});

import { transformSegmentsToParts } from '../utils/messageTransformer';

const buildMessageFromHistory = (record) => {
  const parts = transformSegmentsToParts(record.segments, { messageId: record.id || record._id });
  return {
    id: record.id || record._id,
    role: record.role,
    parts:
      parts.length > 0
        ? parts
        : [{ type: 'text', content: record.content || '', status: 'success' }],
    status: 'success',
    createdAt: new Date(record.createdAt).getTime(),
  };
};

// Added optional dataProvider for decoupled data access (strategy pattern).
// Falls back to import-time getConversationMessages if dataProvider is not provided.
export function useConversationHistory({ initialPlaceholderKey, dataProvider, enabled = true }) {
  // console.log('%c[useConversationHistory·DIAG] 初始化', 'color:#f59e0b;font-weight:bold', {
  //   initialPlaceholderKey,
  //   hasLoadThreadsFn: !!loadThreadsFn,
  //   enabled,
  // });
  const placeholderConversation = useMemo(
    () => ({
      key: initialPlaceholderKey,
      label: '新的对话',
      timestamp: Date.now(),
      icon: React.createElement(PieChartOutlined),
      group: new Date().toLocaleDateString(),
    }),
    [initialPlaceholderKey],
  );

  const [messagesMap, setMessagesMap] = useState({
    [initialPlaceholderKey]: [],
  });
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const {
    conversations,
    activeConversationKey,
    setActiveConversationKey,
    addConversation,
    setConversation,
    setConversations,
    getConversation,
  } = useXConversations({
    defaultConversations: [placeholderConversation],
    defaultActiveConversationKey: initialPlaceholderKey,
  });

  // [DIAG] activeKey 变化追踪
  // useEffect(() => {
  //   console.log('%c[useConversationHistory·DIAG] activeKey 变化', 'color:#f59e0b;font-weight:bold', {
  //     activeConversationKey,
  //     isPlaceholder: activeConversationKey === initialPlaceholderKey,
  //     messagesMapKeys: Object.keys(messagesMap),
  //     currentMsgCount: (messagesMap[activeConversationKey] || []).length,
  //   });
  // }, [activeConversationKey, initialPlaceholderKey, messagesMap]);

  const loadThreads = useCallback(async () => {
    if (!dataProvider?.loadThreads) {
      console.warn(
        '%c[useConversationHistory·DIAG] loadThreads: 无 dataProvider.loadThreads，跳过',
        'color:#ef4444;font-weight:bold',
      );
      return;
    }
    setLoadingThreads(true);
    try {
      const items = await dataProvider.loadThreads();
      const historyThreads = (items || []).map(buildThreadMeta);
      const unique = historyThreads.filter((item) => item.key !== initialPlaceholderKey);
      setConversations([placeholderConversation, ...unique]);
      if (unique.length > 0) {
        setActiveConversationKey(unique[0].key);
      }
    } catch (error) {
      console.warn('加载会话列表失败', error);
    } finally {
      setLoadingThreads(false);
    }
  }, [
    dataProvider?.loadThreads,
    placeholderConversation,
    initialPlaceholderKey,
    setConversations,
    setActiveConversationKey,
  ]);

  useEffect(() => {
    if (enabled) {
      loadThreads();
    }
  }, [loadThreads, enabled]);

  const loadMessages = useCallback(
    async (convId) => {
      if (!convId || convId === initialPlaceholderKey || messagesMap[convId]) {
        return;
      }
      setLoadingMessages(true);
      try {
        // Prefer dataProvider.loadMessages; keep import-time fallback for backward compat
        const data = dataProvider?.loadMessages
          ? await dataProvider.loadMessages(convId)
          : (await import('../../../api/conversations')).getConversationMessages(convId);
        const msgs = (data.messages || []).map(buildMessageFromHistory);
        setMessagesMap((prev) => ({ ...prev, [convId]: msgs }));
      } catch (error) {
        console.warn('加载会话消息失败', error);
      } finally {
        setLoadingMessages(false);
      }
    },
    [initialPlaceholderKey, messagesMap, dataProvider?.loadMessages],
  );

  useEffect(() => {
    if (
      enabled &&
      activeConversationKey &&
      activeConversationKey !== initialPlaceholderKey &&
      !messagesMap[activeConversationKey]
    ) {
      loadMessages(activeConversationKey);
    }
  }, [activeConversationKey, initialPlaceholderKey, loadMessages, enabled, messagesMap]);

  const createPlaceholderThread = useCallback(() => {
    setActiveConversationKey(initialPlaceholderKey);
    setMessagesMap((prev) => {
      if (prev[initialPlaceholderKey]) return prev;
      return { ...prev, [initialPlaceholderKey]: [] };
    });
    return initialPlaceholderKey;
  }, [initialPlaceholderKey, setActiveConversationKey]);

  // SSE 返回真实会话信息，迁移消息映射并更新 activeKey
  const applyRealConversationInfo = useCallback(
    (realId, title) => {
      // console.log('%c[useConversationHistory·DIAG] applyRealConversationInfo', 'color:#f59e0b;font-weight:bold', {
      //   realId,
      //   title,
      //   activeConversationKey,
      //   isSameAsActive: realId === activeConversationKey,
      // });
      if (!realId || realId === activeConversationKey) return;
      setMessagesMap((prev) => {
        if (!prev[initialPlaceholderKey]) return prev;
        const next = { ...prev };
        next[realId] = next[initialPlaceholderKey];
        delete next[initialPlaceholderKey];
        return next;
      });
      const threadMeta = {
        key: realId,
        label: title || realId,
        timestamp: Date.now(),
        icon: React.createElement(PieChartOutlined),
        group: new Date().toLocaleDateString(),
      };
      const exists = getConversation?.(realId);
      if (exists && title) {
        setConversation(realId, threadMeta);
      } else {
        addConversation(threadMeta, 'prepend');
      }
    },
    [
      initialPlaceholderKey,
      activeConversationKey,
      getConversation,
      addConversation,
      setConversation,
    ],
  );

  // 在指定 key 下追加一条消息（增加 ID 排重校验）
  const appendMessageToKey = useCallback((key, m) => {
    if (!key || !m?.id) return;
    setMessagesMap((prev) => {
      const arr = prev[key] || [];
      if (arr.some((existing) => existing.id === m.id)) return prev;
      return { ...prev, [key]: [...arr, m] };
    });
  }, []);

  const threads = useMemo(
    () => (conversations || []).filter((item) => item.key !== initialPlaceholderKey),
    [conversations, initialPlaceholderKey],
  );

  return {
    threads,
    loadingThreads,
    loadingMessages,
    activeKey: activeConversationKey,
    setActiveKey: setActiveConversationKey,
    messagesMap,
    loadThreads,
    loadMessages,
    createPlaceholderThread,
    applyRealConversationInfo,
    appendMessageToKey,
  };
}

export default useConversationHistory;
