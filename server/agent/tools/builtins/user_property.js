import { z } from 'zod';
import { getProperty, setProperty } from '../../../services/userProperty.service.js';
import { logger } from '../../../config/logger.js';

/**
 * read_user_property
 * Fetches private key-value pairs for the current user.
 */
export const readUserProperty = {
  isGlobal: false,
  name: 'read_user_property',
  description:
    '【私有配置读取】：基于 Key 从用户私有属性库中检索持久化的配置、凭据或偏好设置。这是 AI 实现“长期记忆”和“多技能协同配置”的核心工具。',
  inputSchema: z.object({
    key: z
      .string()
      .describe('唯一的属性名称 (如: "dingtalk_bots", "openai_keys", "user_preferred_language")'),
    defaultValue: z.any().optional().describe('如果查询失败或不存在时返回的默认值'),
  }),
  execute: async ({ key, defaultValue }, context) => {
    const { userId } = context || {};
    if (!userId)
      throw new Error('Authentication context missing: userId required for read_user_property');
    if (!key) throw new Error('Missing key for read_user_property');

    try {
      const value = await getProperty(userId, key, defaultValue);
      return { key, value, success: true };
    } catch (err) {
      logger.error({ err, userId, key }, '[Tools] read_user_property failed');
      return { key, value: defaultValue, success: false, error: err.message };
    }
  },
};

/**
 * write_user_property
 * Saves or updates private key-value pairs for the current user.
 */
export const writeUserProperty = {
  isGlobal: false,
  name: 'write_user_property',
  description:
    '【私有配置持久化】：将本次交付中确认的凭据、Webhook 地址或用户偏好永久保存到数据库。支持覆盖或增量更新。可以设置生存时间 (TTL) 让变量在指定时间后过期删除。',
  inputSchema: z.object({
    key: z.string().describe('唯一的属性名称'),
    value: z.any().describe('需要保存的内容 (支持 String, Number, Array, Object)'),
    strategy: z
      .enum(['overwrite', 'increment', 'ignore'])
      .default('overwrite')
      .describe('保存策略: overwrite(覆盖), increment(自增), ignore(存在则忽略)'),
    ttl: z
      .number()
      .optional()
      .describe('生存时间 (Time-To-Live，单位为秒)，过期后变量将自动失效删除'),
  }),
  execute: async ({ key, value, strategy, ttl }, context) => {
    const { userId } = context || {};
    if (!userId)
      throw new Error('Authentication context missing: userId required for write_user_property');
    if (!key) throw new Error('Missing key for write_user_property');

    try {
      const newValue = await setProperty(userId, key, value, strategy, ttl);
      return { key, value: newValue, success: true };
    } catch (err) {
      logger.error({ err, userId, key, strategy, ttl }, '[Tools] write_user_property failed');
      return { key, success: false, error: err.message };
    }
  },
};
