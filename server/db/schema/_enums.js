import { mySchema } from './_base.js';

/**
 * Centrally managed enums for Gateway and Workflow operations.
 * Prevents duplicate enum generation in Drizzle SQL migrations.
 */

// Status of a physical channel (e.g., active, failing, manually disabled)
export const channelStatusEnum = mySchema.enum('channel_status', ['ACTIVE', 'ERROR', 'INACTIVE']);

// Specific capabilities a channel provider offers
export const channelCapabilityEnum = mySchema.enum('channel_capability', [
  'INBOUND',    // Can receive messages/webhooks
  'OUTBOUND',   // Can send push messages
  'STREAMING',  // Supports SSE or similar real-time streaming
  'CARD',       // Supports interactive message cards (e.g., DingTalk/Lark Cards)
]);

// Status of a workflow subscription/binding
export const bindingStatusEnum = mySchema.enum('binding_status', ['ENABLED', 'DISABLED']);

// 消息片段类型 (统一了业务类型与 AI 角色)

export const chatMessageSegmentTypeEnum = mySchema.enum('chat_message_segment_type', [
  'user',
  'assistant',
  'system',
  'thought',
  'tool_call',
  'tool_output',
  'chart_data',
  'stage',
]);
// 消息物理角色
export const chatMessageRoleEnum = mySchema.enum('chat_message_role', [
  'user',
  'assistant',
  'system',
  'tool',
]);


// 文档分类
export const documentTypeEnum = mySchema.enum('document_type', [
  'general',
  'ai_memory',
  'ai_memory_archive',
]);

// 文档用途/AI 属性
export const documentPurposeEnum = mySchema.enum('document_purpose', [
  'NORMAL',
  'SKILL',
  'KNOWLEDGE',
]);

// 共享目标类型
export const shareTargetTypeEnum = mySchema.enum('share_target_type', [
  'ALL',
  'ROLE',
  'DEPARTMENT',
  'USER',
]);

// 权限级别
export const permissionLevelEnum = mySchema.enum('permission_level', ['VIEW', 'EDIT']);

// 仪表盘项类型
export const userDashboardItemTypeEnum = mySchema.enum('user_dashboard_item_type', ['favorite', 'recent', 'views']);

// 仪表盘引用类型
export const userDashboardRefTypeEnum = mySchema.enum('user_dashboard_ref_type', ['Application', 'Document', 'View']);
