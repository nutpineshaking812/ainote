/**
 * Worker Message Types
 *
 * 定义所有 Worker 消息类型常量，避免硬编码字符串
 */

// ========== 通用消息类型 ==========
export const MSG_INIT = 'INIT';
export const MSG_INIT_SUCCESS = 'INIT_SUCCESS';
export const MSG_INIT_ERROR = 'INIT_ERROR';
export const MSG_SUCCESS = 'SUCCESS';
export const MSG_ERROR = 'ERROR';

// ========== SQL 操作 ==========
export const MSG_EXEC = 'EXEC';
export const MSG_QUERY = 'QUERY';

// ========== 资源缓存操作 ==========
export const MSG_RESOURCES_GET_ALL = 'RESOURCES_GET_ALL';
export const MSG_RESOURCES_UPSERT_BATCH = 'RESOURCES_UPSERT_BATCH';
export const MSG_RESOURCES_CLEAR_APP = 'RESOURCES_CLEAR_APP';
export const MSG_RESOURCES_GET_SYNC_TIME = 'RESOURCES_GET_SYNC_TIME';
export const MSG_RESOURCES_UPDATE = 'RESOURCES_UPDATE';
export const MSG_RESOURCES_DELETE = 'RESOURCES_DELETE';
export const MSG_RESOURCES_DELETE_BATCH = 'RESOURCES_DELETE_BATCH';

// ========== 未来扩展: 表单草稿操作 ==========
// export const MSG_DRAFTS_SAVE = 'DRAFTS_SAVE';
// export const MSG_DRAFTS_GET_BY_FORM = 'DRAFTS_GET_BY_FORM';
// export const MSG_DRAFTS_DELETE = 'DRAFTS_DELETE';

// ========== 未来扩展: 文档缓存操作 ==========
// export const MSG_DOCS_CACHE = 'DOCS_CACHE';
// export const MSG_DOCS_GET = 'DOCS_GET';
// export const MSG_DOCS_CLEAR = 'DOCS_CLEAR';
