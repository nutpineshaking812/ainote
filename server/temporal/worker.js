import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities.js';
import { logger } from '../config/logger.js';
import env from '../config/env.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runWorker() {
  // 确保插件系统已初始化，以便活动（Activities）执行插件逻辑时上下文正常
  try {
    console.log('[TemporalWorker] Initializing plugin service...');
    const { default: pluginService } = await import('../services/plugin.service.js');
    await pluginService.init();
  } catch (err) {
    logger.error({ err }, 'Failed to initialize plugin service in worker');
  }

  console.log(`[TemporalWorker] Connecting to Temporal at ${env.TEMPORAL_ADDRESS}...`);
  const connection = await NativeConnection.connect({
    address: env.TEMPORAL_ADDRESS,
  });
  console.log('[TemporalWorker] Native connection established.');

  console.log(`[TemporalWorker] Creating worker for task queue: ${env.TEMPORAL_TASK_QUEUE}...`);
  const worker = await Worker.create({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    workflowsPath: resolve(__dirname, './workflows.js'),
    activities,
    taskQueue: env.TEMPORAL_TASK_QUEUE,
  });

  console.log('[TemporalWorker] Worker created successfully. Starting to run...');
  logger.info('Temporal Worker is starting...');
  await worker.run();
  console.log('[TemporalWorker] Worker has stopped.');
}

// 支持直接通过 node 运行该脚本，或在 PM2 生产环境下作为 Worker 进程运行
const isEntry =
  process.argv[1] === __filename ||
  (process.argv[1] && resolve(process.argv[1]) === __filename) ||
  process.env.IS_TEMPORAL_WORKER === 'true';

if (isEntry) {
  runWorker().catch((err) => {
    console.error('Fatal error in Temporal Worker:', err);
    process.exit(1);
  });
}

