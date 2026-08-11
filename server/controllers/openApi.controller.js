import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import ApplicationRepository from '../repositories/application.repository.js';
import ApiKeyRepository from '../repositories/apiKey.repository.js';
import UserRepository from '../repositories/user.repository.js';
import { formRepository } from '../repositories/form.repository.js';
import { formRecordRepository } from '../repositories/formRecord.repository.js';
import { db } from '../db/index.js';
import { formRecords as formRecordsTable } from '../db/schema/index.js';
import { sql } from 'drizzle-orm';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { SSEWriter } from '../utils/stream.protocol.js';
import { logger } from '../config/logger.js';
import {
  normalizeFieldsRecordable,
  sanitizeDataPayload,
  validateDataPayload,
} from '../utils/formFieldUtils.js';
import digitalEmployeeService from '../services/digitalEmployee.service.js';
import ChatConversationRepository from '../repositories/chatConversation.repository.js';
import ChatMessageRepository from '../repositories/chatMessage.repository.js';
import env from '../config/env.js';
import bcrypt from 'bcryptjs';

/**
 * 提取 Bearer token 或 X-API-Key Header
 */
const extractApiKey = (req) => {
  const authHeader = req.headers.authorization;
  const headerKey = req.headers['x-api-key'];
  logger.debug('[openApi:extractApiKey] Authorization header:', authHeader ? `${authHeader.substring(0, 30)}...` : '(none)');
  logger.debug('[openApi:extractApiKey] x-api-key header:', headerKey || '(none)');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return headerKey || null;
};

/** 快速判断字符串是否为 JWT（三段 base64url，点分隔） */
const looksLikeJWT = (str) => /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(str || '');

/**
 * 验证 API Key（bcrypt 比对）并返回 key 文档 + app
 */
const verifyAndResolveKey = async (appId, token) => {
  logger.debug('[openApi:verifyAndResolveKey] appId:', appId);
  logger.debug('[openApi:verifyAndResolveKey] token length:', token?.length, 'prefix:', token?.substring(0, 10));

  const app = await ApplicationRepository.findById(appId);
  if (!app) {
    logger.debug('[openApi:verifyAndResolveKey] Application not found for appId:', appId);
    throw ApiError.notFound('Application not found');
  }
  logger.debug('[openApi:verifyAndResolveKey] app found, owner:', app.owner, 'orgId:', app.organizationId);

  const keys = await ApiKeyRepository.findByApp(appId);
  logger.debug('[openApi:verifyAndResolveKey] API keys count:', keys.length);
  if (keys.length > 0) {
    logger.debug('[openApi:verifyAndResolveKey] key docs:', keys.map(k => ({ id: k.id, hashLen: k.hash?.length, hashPrefix: k.hash?.substring(0, 20) })));
  }

  let validKeyDoc = null;

  for (const keyDoc of keys) {
    const match = await bcrypt.compare(token, keyDoc.hash);
    logger.debug('[openApi:verifyAndResolveKey] bcrypt compare with key', keyDoc.id, '=> match:', match);
    if (match) {
      validKeyDoc = keyDoc;
      break;
    }
  }

  if (!validKeyDoc) {
    logger.debug('[openApi:verifyAndResolveKey] No matching API key found -> 401');
    throw ApiError.unauthorized('Invalid API Key');
  }

  logger.debug('[openApi:verifyAndResolveKey] matched key doc:', validKeyDoc.id);
  // Update lastUsedAt
  ApiKeyRepository.updateLastUsed(validKeyDoc.id).catch(console.error);

  return { app, keyDoc: validKeyDoc };
};

/**
 * 双模认证中间件 — 同时支持 API Key 和 createSession 签发的 JWT：
 * 1. 如果 token 看起来像 JWT → 用 jwt.verify 解析，从 payload 取 appId/owner
 * 2. 否则 → 走 bcrypt 比对的 API Key 验证
 *
 * 这样嵌入 UI 场景下，axios 拦截器自动携带的 JWT 也能通过 Open API 认证，
 * 无需额外区分请求来源。
 */
export const verifyApiKey = asyncHandler(async (req, res, next) => {
  logger.debug('[openApi:verifyApiKey] ===== START, method:', req.method, 'path:', req.path);
  const { appId } = req.params;
  const token = extractApiKey(req);

  if (!token) {
    logger.debug('[openApi:verifyApiKey] No token -> 401');
    throw ApiError.unauthorized('Missing API Key / Token');
  }

  logger.debug('[openApi:verifyApiKey] looksLikeJWT:', looksLikeJWT(token));

  // ── 分支 1：JWT（由 createSession 签发，payload 含 appId / type:api_key）──
  if (looksLikeJWT(token)) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      logger.debug('[openApi:verifyApiKey] JWT decoded, type:', decoded.type, 'appId:', decoded.appId);
      // 只接受由 createSession 签发的会话 Token
      if (decoded.type !== 'api_key' || decoded.appId !== appId) {
        logger.debug('[openApi:verifyApiKey] JWT type/appId mismatch -> 401');
        throw ApiError.unauthorized('Token not valid for this application');
      }

      const app = await ApplicationRepository.findById(appId);
      if (!app) throw ApiError.notFound('Application not found');

      logger.debug('[openApi:verifyApiKey] JWT auth OK, userId:', decoded.id);
      // 将 JWT 中的用户身份注入 appContext，避免后续 handler 重复查库
      req.appContext = {
        ...app,
        _id: app.id,
        _authMode: 'jwt',
        _jwtUserId: decoded.id,
      };
      return next();
    } catch (err) {
      logger.debug('[openApi:verifyApiKey] JWT verify error:', err.name, err.message);
      // jwt 验证失败时提示友好信息，不要直接裸抛
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized(
          err.name === 'TokenExpiredError'
            ? 'Session token expired, please refresh'
            : 'Invalid session token',
        );
      }
      throw err;
    }
  }

  // ── 分支 2：API Key（原始密钥，bcrypt 比对）──
  logger.debug('[openApi:verifyApiKey] Trying API Key auth...');
  const { app } = await verifyAndResolveKey(appId, token);
  logger.debug('[openApi:verifyApiKey] API Key auth OK');
  req.appContext = { ...app, _id: app.id, _authMode: 'api_key' };
  next();
});

/**
 * @desc    Submit data to a form via Open API
 */
export const submitForm = asyncHandler(async (req, res) => {
  const { formId } = req.params;
  const form = await formRepository.findById(formId);
  if (!form) throw ApiError.notFound('Form not found');

  if (form.appId.toString() !== req.appContext._id.toString()) {
    throw ApiError.badRequest('Form does not belong to this application');
  }

  const normalizedFields = normalizeFieldsRecordable(form.fields);
  const payload = req.body || {};
  const sanitized = sanitizeDataPayload(normalizedFields, payload);
  const validationErrors = validateDataPayload(normalizedFields, sanitized, { mode: 'create' });

  if (validationErrors.length) {
    throw ApiError.badRequest(validationErrors[0], 'DATA_VALIDATION');
  }

  for (const field of normalizedFields) {
    if (field.validation?.unique) {
      const value = sanitized[field.id];
      if (value) {
        const [existing] = await db
          .select()
          .from(formRecordsTable)
          .where(sql`${formRecordsTable.formId} = ${form.id} AND ${formRecordsTable.data}->>${field.id} = ${value}`)
          .limit(1);
        if (existing) {
          throw ApiError.badRequest(
            `Field "${field.properties?.label}" must be unique`,
            'UNIQUENESS_VIOLATION',
          );
        }
      }
    }
  }

  const record = await formRecordRepository.create({
    formId: form.id,
    appId: form.appId,
    data: sanitized,
    createdBy: null,
    submitSource: 'EXTERNAL_API',
  });
 
  sendSuccess(res, { id: record.id, createdAt: record.createdAt }, 201);
});

/**
 * @desc    Get records via Open API
 */
export const getRecords = asyncHandler(async (req, res) => {
  const { formId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const form = await formRepository.findById(formId);
  if (!form) throw ApiError.notFound('Form not found');

  if (form.appId.toString() !== req.appContext._id.toString()) {
    throw ApiError.badRequest('Form does not belong to this application');
  }

  const records = await formRecordRepository.findByFormId(formId, {
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
    sortBy: 'createdAt',
    order: 'desc'
  });
 
  const total = await formRecordRepository.countByFormId(formId);

  sendSuccess(res, {
    records,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * @desc    通过 API Key 创建会话，返回 JWT Token（用于嵌入 UI 场景）
 * @route   POST /api/v1/open/apps/:appId/session
 */
export const createSession = asyncHandler(async (req, res) => {
  logger.debug('[openApi:createSession] ===== START =====');
  logger.debug('[openApi:createSession] req.params:', JSON.stringify(req.params));
  logger.debug('[openApi:createSession] JWT_SECRET configured:', !!env.JWT_SECRET);

  // 确保 JWT_SECRET 已配置，否则签发出的 token 无法被 protect 中间件验证
  if (!env.JWT_SECRET) {
    logger.debug('[openApi:createSession] JWT_SECRET is empty -> 500');
    throw ApiError.internal(
      'Server JWT_SECRET is not configured. Please set JWT_SECRET in environment variables.',
    );
  }

  const { appId } = req.params;
  const token = extractApiKey(req);

  if (!token) {
    logger.debug('[openApi:createSession] No token extracted -> 401');
    throw ApiError.unauthorized('Missing API Key');
  }

  logger.debug('[openApi:createSession] token extracted, calling verifyAndResolveKey...');
  const { app, keyDoc } = await verifyAndResolveKey(appId, token);

  // 以应用拥有者作为会话用户身份
  const ownerUser = await UserRepository.findById(app.owner);
  if (!ownerUser) {
    throw ApiError.internal('Application owner not found');
  }

  // 签发 JWT（24 小时有效期）
  // payload 中标记 type: 'api_key'，verifyApiKey 中间件会识别此标记
  const jwtToken = jwt.sign(
    { id: ownerUser.id, type: 'api_key', appId, apiKeyId: keyDoc.id },
    env.JWT_SECRET,
    { expiresIn: '24h' },
  );

  logger.debug('[openApi:createSession] SUCCESS, userId:', ownerUser.id);
  sendSuccess(res, {
    token: jwtToken,
    expiresIn: 86400,
    userId: ownerUser.id,
    appId,
  });
});

/**
 * @desc    获取应用的数字员工列表（通过 API Key 认证）
 * @route   GET /api/v1/open/apps/:appId/employees
 */
export const getEmployees = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { scenario } = req.query;

  const employees = await digitalEmployeeService.getEmployees(appId, scenario || undefined);

  // 脱敏返回：只暴露必要的公开字段
  const safeList = employees.map((emp) => ({
    id: emp.id,
    name: emp.name,
    roleTitle: emp.roleTitle,
    avatar: emp.avatar,
    description: emp.description,
    scenario: emp.scenario,
    isActive: emp.isActive,
    metadata: {
      welcomePrompt: emp.metadata?.welcomePrompt || '',
      quickTools: (emp.metadata?.quickTools || []).map((t) => ({
        title: t.title,
        payload: t.payload,
      })),
    },
    createdAt: emp.createdAt,
  }));

  sendSuccess(res, safeList);
});

/**
 * @desc    获取会话列表（Open API 版）
 * @route   GET /api/v1/open/apps/:appId/conversations
 */
export const listConversations = asyncHandler(async (req, res) => {
  const { appId } = req.params;
  const { limit = 20, targetId, employeeId, scenario } = req.query;

  // 获取操作用户身份（JWT 模式优先，API Key 模式降级为 app owner）
  const userId = req.appContext._jwtUserId || req.appContext.owner;
  if (!userId) {
    throw ApiError.unauthorized('Unable to resolve user identity');
  }

  const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const items = await ChatConversationRepository.findByUserAndApp(userId, appId, {
    limit: l,
    targetId,
    employeeId,
    scenario,
  });

  const data = items.map((c) => ({
    id: c.id,
    title: c.title || c.id,
    scenario: c.scenario,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: 0,
  }));

  sendSuccess(res, { items: data, page: 1, limit: l, total: items.length });
});

/**
 * @desc    获取指定会话的消息列表（Open API 版）
 * @route   GET /api/v1/open/apps/:appId/conversations/:conversationId/messages
 */
export const getConversationMessages = asyncHandler(async (req, res) => {
  const { appId, conversationId } = req.params;
  const { limit } = req.query;

  const userId = req.appContext._jwtUserId || req.appContext.owner;
  if (!userId) {
    throw ApiError.unauthorized('Unable to resolve user identity');
  }
  if (!conversationId) {
    throw ApiError.badRequest('conversationId is required');
  }

  const convo = await ChatConversationRepository.findById(conversationId);
  if (!convo) {
    throw ApiError.notFound('Conversation not found');
  }
  // Verify the conversation belongs to this app and user
  if (convo.appId !== appId || convo.userId !== userId) {
    throw ApiError.forbidden('Access denied for this conversation');
  }

  const lim = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200) : 50;
  const msgs = await ChatMessageRepository.findRecentWithSegments(conversationId, lim);

  const data = msgs.map((m) => ({
    id: m.id,
    role: m.role,
    segments: m.segments.map((seg) => ({
      segmentId: seg.id,
      id: seg.id,
      type: seg.type,
      text: seg.content,
      createdAt: seg.createdAt,
    })),
    createdAt: m.createdAt,
  }));

  sendSuccess(res, { conversation: { id: convo.id, scenario: convo.scenario }, messages: data });
});

/**
 * @desc    数字员工流式对话（通过 API Key 认证，SSE）
 * @route   POST /api/v1/open/apps/:appId/employees/chat
 */
export const chatWithEmployee = asyncHandler(async (req, res) => {
  // 兼容两种 payload 格式：
  // - Open API 直接调用：{ employeeId, conversationId, content, inputs }
  // - 客户端嵌入模式：{ data: { employeeId, ... }, conversationId, content, inputs }
  const employeeId =
    req.body.employeeId || req.body.data?.employeeId || req.body.inputs?.employeeId;

  const { conversationId, content, inputs } = req.body;

  if (!employeeId) {
    throw ApiError.badRequest('Missing employeeId');
  }

  // 获取操作用户身份：
  // - JWT 模式：payload 中已携带 userId，可直接使用避免查库
  // - API Key 模式：以 app owner 作为会话用户
  const userId = req.appContext._jwtUserId || req.appContext.owner;
  const ownerUser = await UserRepository.findById(userId);
  if (!ownerUser) {
    throw ApiError.internal('Application owner not found');
  }

  const virtualUser = {
    ...ownerUser,
    // 标记来源为外部调用，便于审计
    _source: 'external_api',
  };

  const writer = new SSEWriter(res);

  return digitalEmployeeService.streamEmployeeChat(writer, {
    employeeId,
    user: virtualUser,
    orgId: req.appContext.organizationId,
    conversationId,
    message: content || '',
    data: inputs || {},
  });
});
