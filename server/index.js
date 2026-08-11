import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import env from './config/env.js';
import { logger, httpLogger } from './config/logger.js';

import { initFixedInvitation } from './scripts/initFixedInvitation.js';

// Initialize Express app
const app = express();

// 最早的请求日志 - 在所有中间件之前
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n========== ${timestamp} ==========`);
  console.log(`${req.method} ${req.url}`);
  console.log(`Origin: ${req.headers.origin || 'none'}`);
  console.log(`Authorization: ${(req.headers.authorization || 'none').substring(0, 50)}`);
  console.log('=====================================\n');
  next();
});

// Middleware
// attach HTTP logger early so requests are logged
// app.use(httpLogger);
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = env.CLIENT_ORIGINS;
      // logger.info({ origin, allowedOrigins }, '[CORS] Checking origin');

      if (
        !origin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        origin === 'tauri://localhost' ||
        origin === 'https://tauri.localhost'
      ) {
        // logger.info('[CORS] ✅ Origin allowed');
        callback(null, true);
      } else {
        // logger.warn('[CORS] ❌ Origin blocked');
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cache-Control',
      'Accept',
      'x-form-token',
      'X-Organization-ID',
      'x-webhook-secret',
      'X-Client-Platform',
      'x-client-platform',
    ],
  }),
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded files statically
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(env.FILE_UPLOAD_DIR),
);

// Basic Route for testing
app.get('/', (req, res) => {
  res.send('Hello from the AINote Platform Backend!');
});

// API Routes
import authRoutes from './routes/auth.routes.js';
import appRoutes from './routes/app.routes.js';
import formRoutes from './routes/form.routes.js'; // Import form routes
import formRecordRoutes from './routes/formRecord.routes.js'; // Import form record routes
import publishRoutes from './routes/publish.routes.js';
import resourcesRoutes from './routes/resources.routes.js';
import publicRoutes from './routes/public.routes.js';
import fileRoutes from './routes/file.routes.js';
import documentRoutes from './routes/document.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import templateRoutes from './routes/template.routes.js';
import aiRoutesModule from './routes/ai.routes.js';
const useAIRoutes = aiRoutesModule?.default || aiRoutesModule;
import conversationRoutesModule from './routes/conversation.routes.js';
const conversationRoutes = conversationRoutesModule?.default || conversationRoutesModule;
import viewRoutes from './routes/view.routes.js';
import viewComponentRoutes from './routes/viewComponent.routes.js';
import userRoutes from './routes/user.routes.js'; // Import user routes
import organizationRoutes from './routes/organization.routes.js'; // Import organization routes
import memberRoutes from './routes/member.routes.js'; // Import member routes
import departmentRoutes from './routes/department.routes.js'; // Import department routes
import roleRoutes from './routes/role.routes.js'; // Import role routes
import openApiRoutes from './routes/openApi.routes.js';
import auditRoutes from './routes/audit.routes.js';
import externalApiRoutes from './routes/externalApi.routes.js';
import ledgerRoutes from './routes/ledger.routes.js';
import orgWidgetRoutes from './routes/orgWidget.routes.js';
import workflowRoutes from './routes/workflow.routes.js';
import gatewayMonitor from './services/gateway/gateway.monitor.js';
import skillRoutes from './routes/skill.routes.js';
import orgCategoryRoutes from './routes/orgCategory.routes.js';
import channelRoutes from './routes/channel.routes.js';
import mcpRoutes from './routes/mcp.routes.js';
import knowledgeSetRoutes from './routes/knowledgeSet.routes.js';
import digitalEmployeeRoutes from './routes/digitalEmployee.routes.js';
import agentDockStateRoutes from './routes/agentDockState.routes.js';
import agentTeamRoutes from './routes/agentTeam.routes.js';
import pluginService from './services/plugin.service.js';

import promptRoutes from './routes/prompt.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/public', publicRoutes); // public record share endpoints
app.get('/api/v1/plugins/all', (req, res) => {
  res.json({ success: true, data: pluginService.getPluginsMetadata() });
});
app.get('/api/v1/plugins/status', (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : null;
  res.json({ success: true, data: pluginService.getPluginsStatus(ids) });
});
app.use('/api/v1/ext', externalApiRoutes); // shortened external API (ext)
app.use('/api/v1/user', userRoutes); // Use user routes
app.use('/api/v1/workflows', workflowRoutes);
app.use('/api/v1/organizations', organizationRoutes); // Use organization routes
app.use('/api/v1/organizations', memberRoutes); // Use member routes (uses org prefix)
app.use('/api/v1/members', memberRoutes); // Use member routes (direct access)
app.use('/api/v1/organizations', departmentRoutes); // Use department routes (uses org prefix)
app.use('/api/v1/departments', departmentRoutes); // Use department routes (direct access)
app.use('/api/v1/organizations', roleRoutes); // Use role routes (uses org prefix)
app.use('/api/v1/roles', roleRoutes); // Use role routes (direct access)
app.use('/api/v1/open', openApiRoutes); // Open API — must be before generic /api/v1 mounts (protect middleware)
app.use('/api/v1/apps', appRoutes);
app.use('/api/v1', templateRoutes);
app.use('/api/v1/prompts', promptRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1', formRoutes); // Form routes now include full /apps/:appId/forms path
app.use('/api/v1/apps/:appId/forms', publishRoutes); // publish & record-share management (mergeParams)
app.use('/api/v1/apps/:appId/resources', resourcesRoutes); // mixed resource ordering endpoints
app.use('/api/v1/apps/:appId/knowledge-sets', knowledgeSetRoutes);
app.use('/api/v1/apps/:appId/digital-employees', digitalEmployeeRoutes);
app.use('/api/v1/apps/:appId/agent-teams', agentTeamRoutes);
app.use('/api/v1/agent-dock-states', agentDockStateRoutes);

app.use('/api/v1/data', formRecordRoutes); // form record management & submit
app.use('/api/v1/documents', documentRoutes); // document CRUD endpoints
app.use('/api/v1/ledger', ledgerRoutes); // ledger endpoints
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/org-widgets', orgWidgetRoutes);
app.use('/api/v1/skills', skillRoutes);
app.use('/api/v1/org-categories', orgCategoryRoutes);
app.use('/api/v1/mcp', mcpRoutes);

app.use('/api/v1/ai', useAIRoutes);
app.use('/api/v1/files', fileRoutes); // file metadata & download endpoints
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1', viewRoutes); // view CRUD (GET/POST only)
app.use('/api/v1', viewComponentRoutes); // view component CRUD (GET/POST only)
app.use('/api/v1/channels', channelRoutes); // Channels

// Fallback 404 (for unmatched API routes) - optional
app.use('/api/v1', (req, res, next) => {
  if (res.headersSent) return next();
  res
    .status(404)
    .json({ success: false, error: { code: 'NOT_FOUND', message: 'API route not found' } });
});

// Global error handler (must be last)
app.use(errorHandler);

// Database + server startup

const UPLOAD_DIR = env.FILE_UPLOAD_DIR;
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const PORT = env.PORT || 5001;
async function startServer() {
  try {


    // Run Drizzle Migrations (must run before any DB queries)
    try {
      const { migrateDB } = await import('./db/index.js');
      await migrateDB();
    } catch (err) {
      logger.error({ err }, '[Startup] Database migration skipped or failed');
      // In some environments, we might want to continue if pg is not critical
    }

    // Initialize fixed invitation code
    await initFixedInvitation();

    // Initialize plugin system
    await pluginService.init();

    // Synchronize global package skills from filesystem to DB registry
    try {
      const { default: skillService } = await import('./services/skill.service.js');
      await skillService.syncPackageSkills();
      logger.info('[Startup] Package skills synchronized successfully');
    } catch (err) {
      logger.error({ err }, 'Failed to synchronize package skills during startup');
    }

    // Initialize workflow scheduler
    const workflowScheduler = (await import('./services/workflow.scheduler.js')).default;
    await workflowScheduler.init();

    // Initialize workflow monitor (event listeners)
    const workflowMonitor = (await import('./services/workflow.monitor.js')).default;
    workflowMonitor.init();

    // 启动全局网关监控（离线推送、机器人等）
    // 当 Gateway 以独立进程运行时（GATEWAY_STANDALONE=true），此处跳过以避免重复初始化
    if (!process.env.GATEWAY_STANDALONE) {
      gatewayMonitor.init();
    }

    // 启动 AI 知识库自动同步中枢
    const { default: knowledgeSync } = await import('./services/knowledge.sync.js');
    knowledgeSync.init();

    // Start Temporal Worker if configured
    if (env.START_TEMPORAL_WORKER) {
      const { runWorker } = await import('./temporal/worker.js');
      runWorker().catch((err) => {
        logger.error({ err }, 'Failed to start Temporal Worker');
      });
    }

    app.listen(PORT, () => {
      logger.info({ port: PORT }, `Server running on port: ${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server due to DB connection error');
    process.exit(1);
  }
}

// Only start the server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
