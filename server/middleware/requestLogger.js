// 中文注释: 简单请求日志中间件，记录 method, url, 查询耗时，后续可替换为更完整的链路追踪。
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    // 这里暂时使用 console，后续可接入 pino + traceId 关联
    console.log(`[AI-REQ] ${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`);
  });
  next();
}

export default requestLogger;
