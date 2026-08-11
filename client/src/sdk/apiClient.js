/**
 * AiNote Chat SDK — API 客户端（纯 JS，无 UI 依赖）
 *
 * 提供编程方式访问数字员工 API 的能力：
 *  - 认证管理（API Key → JWT，自动续期）
 *  - 员工列表
 *  - 会话列表 / 历史消息
 *  - SSE 流式发送消息
 *
 * 使用示例：
 *   const client = new ApiClient({ appId, apiKey, host: 'https://api.example.com' });
 *
 *   // 获取员工
 *   const employees = await client.getEmployees();
 *
 *   // 流式对话
 *   await client.sendMessage({
 *     content: '你好',
 *     employeeId: employees[0].id,
 *     onText: (delta, fullText) => console.log(delta),
 *     onDone: ({ conversationId, messageId }) => console.log('done'),
 *   });
 *
 *   // 历史
 *   const convs = await client.listConversations();
 *   const msgs = await client.getMessages(convs[0].id);
 */

// ============================================================
// SSE 协议解析器（轻量，适配服务端 stream.protocol.js 格式）
// ============================================================

/**
 * 解析 SSE 响应流，逐事件回调
 *
 * @param {ReadableStream} body
 * @param {{
 *   onEvent?: (type: string, data: any) => void,
 *   onDone?: () => void,
 * }} callbacks
 */
async function parseSSEStream(body, callbacks) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // 最后一行可能不完整，保留到下一次
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const jsonStr = trimmed.slice(5).trim(); // 去掉 "data:" 前缀

      // [DONE] 终止信号
      if (jsonStr === '[DONE]') {
        callbacks.onDone?.();
        return;
      }

      try {
        const event = JSON.parse(jsonStr);
        callbacks.onEvent?.(event.type, event);
      } catch (_) {
        // 忽略非 JSON 数据行
      }
    }
  }

  // 流正常结束
  callbacks.onDone?.();
}

// ============================================================
// ApiClient 类
// ============================================================

class ApiClient {
  /**
   * @param {object} config
   * @param {string} config.appId   - 应用 ID
   * @param {string} config.apiKey  - API Key（sk-... 或 app_sk_...）
   * @param {string} [config.host]  - API 服务器地址，如 "https://api.example.com"
   *                                   不传则使用当前页面同源的 /api/v1
   */
  constructor({ appId, apiKey, host = '' } = {}) {
    if (!appId || !apiKey) {
      throw new Error('[AiNoteChat API] appId and apiKey are required');
    }
    this._appId = appId;
    this._apiKey = apiKey;
    this._host = host;
    this._baseUrl = host ? `${host.replace(/\/+$/, '')}/api/v1` : '/api/v1';
    this._token = null;
    this._userId = null;
    this._authPromise = null;
  }

  // ==========================================================
  // 内部：认证
  // ==========================================================

  /** 确保已认证（自动去重并发调用） */
  async _ensureAuth() {
    if (this._token) return;
    if (this._authPromise) {
      return this._authPromise;
    }
    this._authPromise = this._doAuth();
    try {
      await this._authPromise;
    } finally {
      this._authPromise = null;
    }
  }

  async _doAuth() {
    const url = `${this._baseUrl}/open/apps/${this._appId}/session`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this._apiKey}`,
      },
      body: JSON.stringify({}),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || json.error || 'Authentication failed');
    }

    const { token, userId } = json.data;
    this._token = token;
    this._userId = userId;
    return json.data;
  }

  /** 构造带 Auth header 的请求头 */
  _authHeaders(extra = {}) {
    return {
      ...(this._token ? { Authorization: `Bearer ${this._token}` } : {}),
      ...extra,
    };
  }

  // ==========================================================
  // 内部：通用请求
  // ==========================================================

  async _get(path, params = {}) {
    await this._ensureAuth();
    const url = new URL(`${this._baseUrl}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });

    const res = await fetch(url.toString(), {
      headers: this._authHeaders(),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || json.error || `Request failed: ${path}`);
    }
    return json.data;
  }

  // ==========================================================
  // 公开 API
  // ==========================================================

  /**
   * 获取认证信息
   * @returns {Promise<{ token: string, userId: string, appId: string, expiresIn: number }>}
   */
  async getSession() {
    return this._doAuth();
  }

  /**
   * 手动设置 Token（用于外部已有 JWT 的场景）
   * @param {string} token
   * @param {string} [userId]
   */
  setToken(token, userId) {
    this._token = token;
    this._userId = userId || null;
  }

  /**
   * 获取数字员工列表
   * @param {object} [opts]
   * @param {string} [opts.scenario] - 场景过滤 GENERAL | DOCUMENT | VIEW_DESIGN
   * @returns {Promise<Array<{ id, name, roleTitle, avatar, description, scenario, metadata }>>}
   */
  async getEmployees({ scenario } = {}) {
    return this._get(`/open/apps/${this._appId}/employees`, { scenario });
  }

  /**
   * 获取会话列表
   * @param {object} [opts]
   * @param {number} [opts.limit]
   * @param {string} [opts.targetId]    - 绑定的业务对象 ID
   * @param {string} [opts.employeeId]  - 员工 ID
   * @param {string} [opts.scenario]    - 场景
   * @returns {Promise<{ items: Array<{ id, title, scenario, createdAt, updatedAt, messageCount }>, total: number, page: number, limit: number }>}
   */
  async listConversations({ limit, targetId, employeeId, scenario } = {}) {
    return this._get(`/open/apps/${this._appId}/conversations`, {
      limit, targetId, employeeId, scenario,
    });
  }

  /**
   * 获取指定会话的消息历史
   * @param {string} conversationId
   * @param {object} [opts]
   * @param {number} [opts.limit]
   * @returns {Promise<{ conversation: object, messages: Array<{ id, role, parts }> }>}
   */
  async getMessages(conversationId, { limit } = {}) {
    return this._get(
      `/open/apps/${this._appId}/conversations/${conversationId}/messages`,
      { limit },
    );
  }

  /**
   * 发送消息并接收 SSE 流式响应
   *
   * @param {object} opts
   * @param {string} opts.content          - 用户消息文本
   * @param {string} [opts.employeeId]     - 数字员工 ID（不传则使用已激活的员工）
   * @param {string} [opts.scenario]       - 场景，默认 GENERAL
   * @param {string} [opts.conversationId] - 续接已有会话
   * @param {object} [opts.inputs]         - 额外输入上下文
   *
   * @param {function} [opts.onEvent]      - 所有 SSE 事件回调 (type, data)
   * @param {function} [opts.onText]       - 文本增量 (delta: string, fullText: string)
   * @param {function} [opts.onThinking]   - 思考增量 (delta: string, fullText: string)
   * @param {function} [opts.onToolCall]   - 工具调用 (toolName, input, toolCallId)
   * @param {function} [opts.onToolResult] - 工具结果 (toolCallId, output)
   * @param {function} [opts.onError]      - 错误 (error: Error)
   * @param {function} [opts.onDone]       - 流完成 (result: { conversationId, messageId })
   *
   * @returns {Promise<{ conversationId: string, messageId: string, fullText: string }>}
   */
  async sendMessage(opts = {}) {
    const {
      content,
      employeeId,
      scenario = 'GENERAL',
      conversationId,
      inputs,
      // 回调
      onEvent,
      onText,
      onThinking,
      onToolCall,
      onToolResult,
      onError,
      onDone,
    } = opts;

    if (!content) {
      throw new Error('[AiNoteChat API] content is required for sendMessage');
    }

    await this._ensureAuth();

    const body = {
      content,
      scenario,
      appId: this._appId,
      ...(conversationId ? { conversationId } : {}),
      ...(inputs ? { inputs } : {}),
      ...(employeeId ? { employeeId } : {}),
    };

    let fullText = '';
    let fullThinking = '';
    let conversationIdResult = conversationId || null;
    let messageIdResult = null;

    const resolve = async () => {
      const resp = await fetch(
        `${this._baseUrl}/open/apps/${this._appId}/employees/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...this._authHeaders(),
          },
          body: JSON.stringify(body),
        },
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || err.error || `HTTP ${resp.status}`);
      }

      await parseSSEStream(resp.body, {
        onEvent: (type, data) => {
          onEvent?.(type, data);

          // 提取会话和消息 ID
          if ((type === 'data-conversation' || type === 'conversation') && data.conversationId) {
            conversationIdResult = data.conversationId;
            messageIdResult = data.messageId || null;
          }

          // 文本增量
          if (type === 'text-delta') {
            const delta = data.textDelta || data.delta || data.content || '';
            fullText += delta;
            onText?.(delta, fullText);
          }

          // 思考增量
          if (type === 'thinking-delta') {
            const delta = data.textDelta || data.delta || data.content || '';
            fullThinking += delta;
            onThinking?.(delta, fullThinking);
          }

          // 工具调用
          if (type === 'tool-input-start' || type === 'tool-input-available') {
            onToolCall?.(data.toolName, data.input, data.toolCallId);
          }

          // 工具结果
          if (type === 'tool-result' || type === 'tool-output-available') {
            onToolResult?.(data.toolCallId, data.output || data.result);
          }

          // 错误
          if (type === 'error') {
            onError?.(new Error(data.error || data.message || 'Stream error'));
          }
        },
        onDone: () => {
          onDone?.({
            conversationId: conversationIdResult,
            messageId: messageIdResult,
            fullText,
          });
        },
      });
    };

    try {
      await resolve();
    } catch (err) {
      onError?.(err);
      throw err;
    }

    return {
      conversationId: conversationIdResult,
      messageId: messageIdResult,
      fullText,
    };
  }
}

export default ApiClient;
