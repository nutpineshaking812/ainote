import { useState, useCallback, useRef, useEffect } from 'react';
import { API_URL } from '../api';

/**
 * 统一的聊天 Hook - 使用标准 SSE 格式
 *
 * @param {string} endpoint - API 端点
 * @param {Object} options - 配置
 * @param {string} options.conversationId - 会话 ID
 * @param {string} options.type - 会话类型
 * @param {string} options.appId - 应用 ID
 * @param {Function} options.onFinish - 完成回调
 * @param {Function} options.onStreamEnd - 流结束回调，接收最终的 messages 数组
 */
export const useUnifiedChat = (
  endpoint,
  { conversationId: initialConversationId, type, appId, onFinish, onStreamEnd } = {},
) => {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [conversationTitle, setConversationTitle] = useState('');
  const [status, setStatus] = useState('ready'); // 'ready' | 'submitted' | 'streaming' | 'error'
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);
  const currentAssistantMessageRef = useRef(null);
  const conversationIdRef = useRef('');

  /**
   * 发送消息并处理 SSE 流
   */
  const sendMessage = useCallback(
    async (text, extras = {}) => {
      const trimmed = (text || '').trim();
      if (!trimmed) return;

      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // 添加用户消息
      const userMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        content: trimmed,
        segments: [{ type: 'text', text: trimmed }],
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setStatus('submitted');
      setError(null);

      // 创建助手消息占位
      const assistantMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: '',
        segments: [],
        createdAt: new Date(),
      };

      currentAssistantMessageRef.current = assistantMessage;
      setMessages((prev) => [...prev, assistantMessage]);
      setStatus('streaming');

      try {
        const token = localStorage.getItem('token');
        const orgId = localStorage.getItem('currentOrganizationId');

        const response = await fetch(`${API_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(orgId ? { 'X-Organization-ID': orgId } : {}),
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: trimmed,
              },
            ],
            conversation_id: conversationId,
            type,
            appId,
            ...extras,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留不完整的行

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;

            const data = line.slice(6); // 移除 "data: " 前缀
            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);

              if (event.type === 'data-conversation') {
                const data = event.data;
                setConversationId(data.conversationId);
                setConversationTitle(data.title);
                conversationIdRef.current = data.conversationId; // 立即更新 ref
              } else if (event.type === 'text-delta') {
                fullText += event.textDelta;

                // 更新助手消息
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.content = fullText;
                    lastMessage.segments = [{ type: 'text', text: fullText }];
                  }
                  return newMessages;
                });
              } else if (event.type === 'data') {
                // 处理自定义数据（如图表）
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.segments.push(event.data);
                  }
                  return newMessages;
                });
              } else if (event.type === 'error') {
                setError(event.error);
                setStatus('error');
              } else if (event.type === 'finish') {
                setStatus('ready');

                // 调用流结束回调
              if (onStreamEnd) {
                setMessages((currentMessages) => {
                  onStreamEnd(currentMessages, conversationIdRef.current);
                    return currentMessages;
                  });
                }

                if (onFinish && currentAssistantMessageRef.current) {
                  onFinish(currentAssistantMessageRef.current);
                }
              }
            } catch (parseError) {
              console.error('Failed to parse SSE event:', parseError, data);
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          // Request intentionally aborted
        } else {
          console.error('Stream error:', err);
          setError(err.message);
          setStatus('error');
        }
      }
    },
    [endpoint, conversationId, type, appId, onFinish, onStreamEnd],
  );

  /**
   * 停止当前流
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus('ready');
    }
  }, []);

  /**
   * 清除消息
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    currentAssistantMessageRef.current = null;
  }, []);

  /**
   * 兼容旧的 startStream 接口
   */
  const startStream = useCallback(
    (text, extras = {}) => {
      sendMessage(text, extras);
    },
    [sendMessage],
  );

  // 清理
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // 消息和状态
    messages,
    status, // 'ready' | 'submitted' | 'streaming' | 'error'
    error,
    isLoading: status === 'streaming' || status === 'submitted',

    // 会话信息
    conversationId,
    conversationTitle,
    setConversationId,

    // 消息操作
    sendMessage,
    startStream, // 保持向后兼容
    stop,

    // 消息管理
    setMessages,
    clearMessages,

    // 暂不支持的功能（保持接口兼容）
    regenerate: () => console.warn('regenerate not implemented'),
    resumeStream: () => console.warn('resumeStream not implemented'),
    addToolOutput: () => console.warn('addToolOutput not implemented'),
  };
};

export default useUnifiedChat;
