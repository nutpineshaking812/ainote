import 'dotenv/config';
import { logger } from './config/logger.js';

/**
 * Gateway 独立进程入口
 * 职责：仅初始化网关监控（渠道连接 + 事件监听），不启动 Express / 插件 / 技能同步等主服务逻辑。
 * 依赖：PostgreSQL（共享）+ Temporal（共享）+ workflowEvents LISTEN/NOTIFY
 */
async function startGateway() {
  logger.info('[Gateway] Starting standalone gateway process...');

  // 确保数据库表结构存在（与主服务共享同一 PostgreSQL）
  try {
    const { migrateDB } = await import('./db/index.js');
    await migrateDB();
    logger.info('[Gateway] Database migrations checked.');
  } catch (err) {
    logger.warn({ err }, '[Gateway] DB migration skipped, assuming tables already exist.');
  }

  // 初始化网关监控：加载渠道、启动 Provider 连接、设置 LISTEN/NOTIFY 事件监听
  const { default: gatewayMonitor } = await import('./services/gateway/gateway.monitor.js');
  await gatewayMonitor.init();

  logger.info('[Gateway] Standalone gateway process ready.');
}

startGateway().catch((err) => {
  logger.error({ err }, '[Gateway] Failed to start');
  process.exit(1);
});
