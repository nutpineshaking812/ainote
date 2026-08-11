import pino from 'pino';
import pinoHttp from 'pino-http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV !== 'production';
const logsDir = path.join(__dirname, '../../', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// const filePath = path.join(logsDir, 'app.log');
// const fileDest = pino.destination({ dest: filePath, sync: false });

// human-friendly console logger (dev) or plain JSON console (prod)
const consoleLogger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  base: { pid: false },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'yyyy-mm-dd HH:MM:ss.l', ignore: 'pid,hostname' }
      }
    : undefined
});

// file logger always writes structured JSON
const fileLogger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  base: { pid: false }
}, pino.transport({ // 注意：这里从 pino.destination 变成了 pino.transport
    target: 'pino-roll',
    options: {
      file: path.join(logsDir, 'app.log'), // 基础文件名
      frequency: 'daily', // 关键！设置为“每天”
      mkdir: true, // 自动创建 logs 目录
      // size: '100M', // 也可以同时按大小切割，例如每 100MB
      // timestamp: 'iso', // 可以自定义时间戳格式
    }
}));

// http logger should use the human-friendly consoleLogger (so request logs are readable)
export const httpLogger = pinoHttp({ logger: consoleLogger });

// simple proxy: call both loggers for standard levels
const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
export const logger = {};
levels.forEach((lvl) => {
  logger[lvl] = (...args) => {
    if (consoleLogger && typeof consoleLogger[lvl] === 'function') consoleLogger[lvl](...args);
    if (fileLogger && typeof fileLogger[lvl] === 'function') fileLogger[lvl](...args);
  };
});
// provide child factory too (optional, delegating to consoleLogger.child)
logger.child = (obj) => {
  const c1 = consoleLogger.child ? consoleLogger.child(obj) : consoleLogger;
  const c2 = fileLogger.child ? fileLogger.child(obj) : fileLogger;
  // return a child-like proxy
  const child = {};
  levels.forEach(lvl => {
    child[lvl] = (...a) => { c1[lvl](...a); c2[lvl](...a); };
  });
  child.child = (o) => ({ /* nested child omitted for brevity */ });
  return child;
};

export default { logger, httpLogger, consoleLogger, fileLogger };