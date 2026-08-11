import { API_URL, getCommonHeaders } from '../api';

/**
 * fetchEventSource
 * 
 * 一个轻量级的 SSE 客户端，支持标准 SSE 协议、Vercel Data Stream v1 以及
 * 增强的 Server Actions 语义化协议（支持 data 通道自动解包）。
 */
export const fetchEventSource = (endpoint, options = {}, callbacks) => {
  const { onmessage, onerror, onopen, onclose } = callbacks || {};
  const controller = new AbortController();
  const signal = controller.signal;

  // 补全 API 地址
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  const run = async () => {
    try {
      if (onopen) onopen();

      const headers = getCommonHeaders({
        'Accept': 'text/event-stream',
        ...options.headers,
      });

      const response = await fetch(url, {
        ...options,
        headers,
        signal,
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! Status: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            errorMsg = data.error?.message || data.message || errorMsg;
          }
        } catch (e) {
          // 忽略解析失败
        }
        throw new Error(errorMsg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // 处理标准 SSE "data: " 格式
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              if (onclose) onclose();
              return;
            }

            try {
              const parsed = JSON.parse(dataStr);
              
              // 【强制标准解析】处理数据通道 data[]
              if (parsed && parsed.type === 'data' && Array.isArray(parsed.data)) {
                // 后端标准：{"type":"data","data":[{"type":"node:start",...}]}
                for (const item of parsed.data) {
                  if (item && item.type && onmessage) {
                    onmessage({ 
                      event: item.type, 
                      data: JSON.stringify(item) 
                    });
                  }
                }
                continue; // 数组项已处理，跳过后续发送
              }

              // 【语义原语提权】处理 {"type":"text-delta",...}
              if (parsed && parsed.type && onmessage) {
                onmessage({ 
                  event: parsed.type, 
                  data: dataStr 
                });
                continue;
              }

            } catch (e) {
              // 非 JSON 格式，保持原样发送
            }

            if (onmessage) onmessage({ event: 'message', data: dataStr });
            continue;
          }

          // 处理 Vercel Data Stream v1 原始格式 (如 0:"text")
          if (/^\d+:/.test(trimmed) && onmessage) {
            const colonIndex = trimmed.indexOf(':');
            const type = trimmed.slice(0, colonIndex);
            const content = trimmed.slice(colonIndex + 1);
            onmessage({ event: `stream-${type}`, data: content });
          }
        }
      }

      if (onclose) onclose();
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (onerror) onerror(err);
    }
  };

  run();

  return () => controller.abort();
};

export default fetchEventSource;
