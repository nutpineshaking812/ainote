// 中文注释: 会话临时状态存储(内存版)。用于在等待用户澄清时保存上下文，后续可替换为 MongoDB 持久化。
// sessions Map 结构: sessionId -> { messages, schema, intent, awaitingField, sseRes, ... }
const sessions = new Map();

function createSession(sessionId, initial = {}) {
  sessions.set(sessionId, { ...initial, updatedAt: Date.now() });
  console.log('创建新会话状态，ID:', sessionId);
  return sessions.get(sessionId);
}

function getSession(sessionId) {
  console.log('获取会话状态，ID:', sessionId);
  return sessions.get(sessionId);
}

function updateSession(sessionId, patch) {
  const cur = sessions.get(sessionId) || {};
  console.log('更新会话状态，ID:', sessionId, patch);
  const next = { ...cur, ...patch, updatedAt: Date.now() };
  sessions.set(sessionId, next);
  return next;
}

function deleteSession(sessionId) {
  const s = sessions.get(sessionId);
  console.log('删除会话状态，ID:', sessionId);
  if (s?.sseRes) {
    try { s.sseRes.end(); } catch (e) { /* ignore */ }
  }
  sessions.delete(sessionId);
}

function attachSseResponse(sessionId, res) {
  console.log('附加 SSE 响应，ID:', sessionId);
  const cur = sessions.get(sessionId) || {};
  cur.sseRes = res;
  sessions.set(sessionId, cur);
  return cur;
}

function getSseResponse(sessionId) {
  return sessions.get(sessionId)?.sseRes;
}

function bindSseLifecycle(sessionId, req, res) {
  req.on('close', () => {
    const s = sessions.get(sessionId);
    console.log('连接关闭，ID:', sessionId);
    if (s?.sseRes === res) {
      sessions.delete(sessionId); // 连接关闭即清理会话临时态
    }
  });
}

export {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  attachSseResponse,
  getSseResponse,
  bindSseLifecycle,
};
