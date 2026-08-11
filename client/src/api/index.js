import axios from 'axios';
import { isTauri } from '../utils/platform';

// API 基础 URL
// 开发环境：使用 .env 中配置的完整 URL
// 生产环境：使用相对路径（由 Nginx 代理）
export const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// 1. 创建一个集中的、可配置的 axios 实例
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 设置一个全局超时
});

// 2. 添加一个请求拦截器
api.interceptors.request.use(
  (config) => {
    // 在每个请求中自动附加 token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // 添加组织 ID（如果存在）
    const currentOrgId = localStorage.getItem('currentOrganizationId');
    if (currentOrgId) {
      config.headers['X-Organization-ID'] = currentOrgId;
    }

    // 自动附加客户端平台标识
    if (isTauri) {
      config.headers['X-Client-Platform'] = 'tauri';
    }

    return config;
  },
  (error) => {
    // 对请求错误做些什么
    return Promise.reject(error);
  },
);

// 3. 添加一个响应拦截器
api.interceptors.response.use(
  (response) => {
    // 统一返回后端包装的 data 字段，简化组件中的数据获取
    // 后端接口统一返回 { success: true, data: ... } 的格式
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return response.data.data;
    }
    // 对于文件下载等场景，response.data 可能不是期望的格式
    return response.data;
  },
  (error) => {
    // 统一处理错误
    // 例如，可以在这里处理 401 未授权，跳转到登录页
    if (error.response && error.response.status === 401) {
      // 清除失效令牌
      try {
        localStorage.removeItem('token');
      } catch {}
      const current = window.location.pathname + window.location.search + window.location.hash;
      // 避免重复重定向死循环
      if (!window.location.pathname.startsWith('/login')) {
        const redirectParam = encodeURIComponent(current);
        window.location.href = `/login?redirect=${redirectParam}`;
      }
    }

    // Handle 403 Forbidden for application access (e.g. wrong organization context)
    if (error.response && error.response.status === 403) {
      const apiError = error.response.data?.error;
      // If user is trying to access an app in another org, or generally denied,
      // redirect them back to safety (home page).
      if (
        (typeof apiError === 'string' && apiError.includes('Not authorized')) ||
        (apiError?.message && apiError.message.includes('Not authorized')) ||
        apiError?.code === 'APP_FORBIDDEN'
      ) {
        window.location.href = '/';
      }
    }
    // 返回一个带有标准错误信息的 rejected promise
    const err = error.response?.data?.error;
    let message = 'An unknown error occurred';
    if (typeof err === 'string') {
      message = err;
    } else if (err && typeof err.message === 'string') {
      message = err.message;
    } else if (error.message) {
      message = error.message;
    }
    return Promise.reject(new Error(message));
  },
);

export const getCommonHeaders = (additionalHeaders = {}) => {
  const baseHeaders = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...additionalHeaders,
  };
  if (typeof window === 'undefined') return baseHeaders;
  const token = localStorage.getItem('token');
  const orgId = localStorage.getItem('currentOrganizationId');
  if (token) {
    baseHeaders['Authorization'] = `Bearer ${token}`;
  }
  if (orgId) {
    baseHeaders['X-Organization-ID'] = orgId;
  }
  const isTauri = typeof window !== 'undefined' && (!!window.__TAURI__ || !!window.__TAURI_IPC__ || !!window.__TAURI_INTERNALS__);
  if (isTauri) {
    baseHeaders['X-Client-Platform'] = 'tauri';
  }
  return baseHeaders;
};

export default api;
