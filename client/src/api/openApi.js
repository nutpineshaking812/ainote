import api, { API_URL } from './index';

/**
 * Open API / API Key 管理工具函数
 *
 * ── 内部接口：通过 axios（自动附带 JWT / orgId），用于开发者设置页面
 * ── Open 接口：通过 fetch 直接请求 Open API 端点，用于外部嵌入场景
 */

/**
 * 获取 API 请求的 origin，支持 SDK host 配置覆盖
 * - 正常模式：api.defaults.baseURL = '/api/v1' → 返回 window.location.origin
 * - SDK 模式：api.defaults.baseURL = 'https://api.example.com/api/v1' → 返回该地址
 * @returns {string}
 */
function getApiOrigin() {
  const base = api.defaults.baseURL;
  if (base && (base.startsWith('http://') || base.startsWith('https://'))) {
    return base; // 例如 "https://api.example.com/api/v1"
  }
  return window.location.origin;
}

/**
 * 构建 Open API 完整 URL
 * @param {string} path - API 路径，如 "/open/apps/:appId/employees"
 * @returns {string}
 */
function buildOpenUrl(path) {
  const origin = getApiOrigin();
  // 如果 origin 已包含 /api/v1（SDK host 场景），直接用；否则加前缀
  if (origin.endsWith('/api/v1')) {
    return `${origin}${path}`;
  }
  return `${origin}${API_URL}${path}`;
}

/**
 * 通过 API Key 换取 JWT Session
 * POST /api/v1/open/apps/:appId/session
 */
export const createSession = async (appId, apiKey) => {
  const res = await fetch(`${API_URL}/open/apps/${appId}/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({}),
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    const errMsg = json.error?.message || json.error || 'Session creation failed';
    throw new Error(errMsg);
  }

  return json.data; // { token, expiresIn, userId, appId }
};

/**
 * 获取数字员工列表（Open API 版）
 * GET /api/v1/open/apps/:appId/employees
 *
 * @param {string} appId
 * @param {string} authToken - API Key 或 JWT Token
 * @param {object} [options]
 * @param {string} [options.scenario] - 场景过滤
 */
export const getEmployees = async (appId, authToken, { scenario } = {}) => {
  const url = new URL(buildOpenUrl(`/open/apps/${appId}/employees`));
  if (scenario) {
    url.searchParams.set('scenario', scenario);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    const errMsg = json.error?.message || json.error || 'Failed to fetch employees';
    throw new Error(errMsg);
  }

  return json.data;
};

/**
 * 获取会话列表（Open API 版）
 * GET /api/v1/open/apps/:appId/conversations
 */
export const listConversationsOpen = async (appId, authToken, { limit, targetId, employeeId, scenario } = {}) => {
  const url = new URL(buildOpenUrl(`/open/apps/${appId}/conversations`));
  if (limit) url.searchParams.set('limit', limit);
  if (targetId) url.searchParams.set('targetId', targetId);
  if (employeeId) url.searchParams.set('employeeId', employeeId);
  if (scenario) url.searchParams.set('scenario', scenario);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    const errMsg = json.error?.message || json.error || 'Failed to fetch conversations';
    throw new Error(errMsg);
  }

  return json.data; // { items, page, limit, total }
};

/**
 * 获取指定会话的消息列表（Open API 版）
 * GET /api/v1/open/apps/:appId/conversations/:conversationId/messages
 */
export const getConversationMessagesOpen = async (appId, authToken, conversationId, { limit } = {}) => {
  const url = new URL(
    buildOpenUrl(`/open/apps/${appId}/conversations/${conversationId}/messages`),
  );
  if (limit) url.searchParams.set('limit', limit);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    const errMsg = json.error?.message || json.error || 'Failed to fetch conversation messages';
    throw new Error(errMsg);
  }

  return json.data; // { conversation: {...}, messages: [...] }
};

// ─────────────────────────────────────────────────────────────────
// 内部 API：API Key 管理（开发者设置页面使用，走 axios + JWT）
// ─────────────────────────────────────────────────────────────────

/**
 * 获取应用的所有 API Key
 * GET /api/v1/apps/:appId/apikeys
 */
export const getApiKeys = async (appId) => {
  return api.get(`/apps/${appId}/apikeys`);
};

/**
 * 创建新的 API Key
 * POST /api/v1/apps/:appId/apikeys
 * @returns {{ key: string }} 创建的原始 key（仅此一次可见）
 */
export const createApiKey = async (appId, name) => {
  return api.post(`/apps/${appId}/apikeys`, { name });
};

/**
 * 吊销 API Key
 * DELETE /api/v1/apps/:appId/apikeys/:keyId
 */
export const revokeApiKey = async (appId, keyId) => {
  return api.delete(`/apps/${appId}/apikeys/${keyId}`);
};
