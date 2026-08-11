import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment-specific .env file
// Priority: .env.{NODE_ENV} > .env
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = path.resolve(__dirname, '..', `.env.${nodeEnv}`);
const defaultEnvFile = path.resolve(__dirname, '..', '.env');

// Try to load environment-specific file first, fallback to .env
dotenv.config({ path: envFile });
// Also load .env as fallback for any missing variables
dotenv.config({ path: defaultEnvFile });

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const defaultUploadDir = path.resolve(__dirname, '..', 'storage', 'uploads');
const defaultSkillsDir = path.resolve(__dirname, '..', '..', 'skills');
const defaultPluginsDir = path.resolve(__dirname, '..', 'registry', 'plugins');
const rawClientOrigins = process.env.CLIENT_ORIGIN || '';
const clientOrigins = rawClientOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: toNumber(process.env.PORT, 5001),
  JWT_SECRET: process.env.JWT_SECRET || '',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  CLIENT_ORIGIN: rawClientOrigins,
  CLIENT_ORIGINS: clientOrigins,
  FILE_UPLOAD_DIR: process.env.FILE_UPLOAD_DIR
    ? path.resolve(__dirname, '..', process.env.FILE_UPLOAD_DIR)
    : defaultUploadDir,
  SKILLS_DIR: process.env.SKILLS_DIR ? path.resolve(process.env.SKILLS_DIR) : defaultSkillsDir,
  defaultSkillsDir,
  PLUGINS_DIR: process.env.PLUGINS_DIR ? path.resolve(process.env.PLUGINS_DIR) : defaultPluginsDir,
  MAX_FILE_SIZE_MB: toNumber(process.env.MAX_FILE_SIZE_MB, 5),
  MAX_ATTACHMENT_FILE_SIZE_MB: toNumber(process.env.MAX_ATTACHMENT_FILE_SIZE_MB, 20),
  MARKITDOWN_SERVICE_URL: process.env.MARKITDOWN_SERVICE_URL || 'http://127.0.0.1:5002/v1/convert',
  
  // AI / LLM agent configuration
  llmProviders: (() => {
    const providers = {};
    const providerPattern = /^LLM_([A-Z]+)_(.+)$/;

    Object.keys(process.env).forEach((key) => {
      const match = key.match(providerPattern);
      if (match) {
        const providerName = match[1].toLowerCase();
        const settingName = match[2].toLowerCase();

        if (!providers[providerName]) {
          providers[providerName] = {};
        }

        if (settingName === 'api_key') {
          providers[providerName].apiKey = process.env[key];
        } else if (settingName === 'base_url') {
          providers[providerName].baseURL = process.env[key];
        } else if (settingName === 'model') {
          const models = process.env[key]
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean);
          providers[providerName].model = models[0] || '';
          providers[providerName].models = models;
        }
      }
    });

    return providers;
  })(),

  embeddingConfig: (() => {
    const config = {
      provider: process.env.EMBEDDING_PROVIDER || 'openai',
      apiKey: process.env.EMBEDDING_API_KEY || process.env.LLM_OPENAI_API_KEY,
      baseURL: process.env.EMBEDDING_API_URL || process.env.LLM_OPENAI_BASE_URL,
      model: process.env.EMBEDDING_MODEL_NAME || process.env.OPENAI_MODEL_EMBEDDING || 'text-embedding-3-small',
      dimension: toNumber(process.env.EMBEDDING_DIMENSION, 1536),
    };
    return config;
  })(),

  LLM_DEFAULT_PROVIDER: process.env.LLM_DEFAULT_PROVIDER || 'openai',
  AGENT_RECURSION_LIMIT: toNumber(process.env.AGENT_RECURSION_LIMIT, 15),
  DEFAULT_INVITATION_SLOTS: toNumber(process.env.DEFAULT_INVITATION_SLOTS, 5),
  DEFAULT_ORG_MEMBER_LIMIT: toNumber(process.env.DEFAULT_ORG_MEMBER_LIMIT, 50),
  DEFAULT_TOKEN_BALANCE: toNumber(process.env.DEFAULT_TOKEN_BALANCE, 100000),

  FIXED_INVITATION_CODE: process.env.FIXED_INVITATION_CODE || 'WELCOME2026',

  TEMPORAL_ADDRESS: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  TEMPORAL_NAMESPACE: process.env.TEMPORAL_NAMESPACE || 'default',
  TEMPORAL_TASK_QUEUE: process.env.TEMPORAL_TASK_QUEUE || 'ainote-workflows',
  START_TEMPORAL_WORKER: process.env.START_TEMPORAL_WORKER === 'true',
  DEFAULT_LOCALE: process.env.DEFAULT_LOCALE || 'zh-CN',

  // Storage Provider (e.g. 'qiniu')
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'qiniu',
  QINIU_ACCESS_KEY: process.env.QINIU_ACCESS_KEY || '',
  QINIU_SECRET_KEY: process.env.QINIU_SECRET_KEY || '',
  QINIU_BUCKET: process.env.QINIU_BUCKET || '',
  QINIU_DOMAIN: process.env.QINIU_DOMAIN || '',

  // WeTinker 网关配置
  WETINKER_API_BASE_URL: process.env.WETINKER_API_BASE_URL || '',

  // OpenSandbox 远程沙盒配置

  SANDBOX_SERVER_URL: process.env.SANDBOX_SERVER_URL || 'localhost:5002',
  SANDBOX_API_KEY: process.env.SANDBOX_API_KEY || '',
  SANDBOX_IMAGE: process.env.SANDBOX_IMAGE || 'python:3.12-slim',
  SANDBOX_TIMEOUT: toNumber(process.env.SANDBOX_TIMEOUT, 600),
  SANDBOX_USE_SERVER_PROXY: process.env.SANDBOX_USE_SERVER_PROXY === 'true',
};

export default env;
