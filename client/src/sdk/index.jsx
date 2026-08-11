/**
 * AiNote Chat SDK — 入口文件
 *
 * 对外暴露 window.AiNoteChat，支持两种使用方式：
 *
 * === 方式1：UI 集成（init / destroy）===
 *   AiNoteChat.init({ appId, apiKey, container, chatMode: 'floating' });
 *   AiNoteChat.destroy();
 *
 * === 方式2：API 编程接口（无 UI）===
 *   const api = AiNoteChat.api({ appId, apiKey, host: 'https://...' });
 *   const employees = await api.getEmployees();
 *   await api.sendMessage({ content: '你好', employeeId: '...', onText: (t) => console.log(t) });
 *
 * 构建命令：
 *   cd client && VITE_API_URL='' npm run build:sdk
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import '../utils/dayjs';
import '../i18n';
import SdkChat from './SdkChat';
import ApiClient from './apiClient';
import sdkEventBus from './sdkEventBus';

let rootInstance = null;

/**
 * @param {object} config
 * @param {string} config.appId
 * @param {string} config.apiKey
 * @param {string|Element} config.container      - Dock 按钮容器
 * @param {string|Element} [config.chatContainer] - 侧栏聊天面板容器（panel 模式必填）
 * @param {string} [config.host]
 * @param {string} [config.themeColor]
 * @param {string} [config.chatMode]     - 'floating' | 'fullscreen' | 'panel'，默认 'floating'
 * @param {string} [config.dockPlacement] - 'left' | 'right'，默认 'right'
 * @param {string} [config.scenario]
 * @param {string[]} [config.employeeIds] - 只展示指定 ID 的数字员工，默认展示全部
 * @param {string} [config.employeeId]     - 只展示单个数字员工（等同于 employeeIds: [config.employeeId]）
 * @param {string} [config.streamKey]      - dock 唯一标识，多 dock 场景下区分数据来源
 * @param {object} [config.style]        - Dock 容器额外样式
 * @returns {{ destroy: () => void }}
 */
function init(config = {}) {
  const {
    appId,
    apiKey,
    container,
    chatContainer,
    host = '',
    themeColor,
    chatMode = 'floating',
    dockPlacement = 'right',
    scenario,
    employeeIds: rawEmployeeIds,
    employeeId,
    streamKey,
    style = {},
  } = config;

  // 支持 employeeId 单数语法糖
  const employeeIds = employeeId
    ? [employeeId]
    : rawEmployeeIds;

  if (!appId || !apiKey) {
    console.error('[AiNoteChat SDK] Missing required config: appId or apiKey');
    return { destroy: () => {} };
  }

  // 解析 Dock 容器
  let targetEl;
  if (typeof container === 'string') {
    targetEl = document.querySelector(container);
  } else if (container instanceof Element) {
    targetEl = container;
  }
  if (!targetEl) {
    console.error('[AiNoteChat SDK] Dock container not found:', container);
    return { destroy: () => {} };
  }

  // 解析聊天面板容器（panel 模式）
  let chatContainerEl = null;
  if (chatContainer) {
    if (typeof chatContainer === 'string') {
      chatContainerEl = document.querySelector(chatContainer);
    } else if (chatContainer instanceof Element) {
      chatContainerEl = chatContainer;
    }
    if (!chatContainerEl && chatMode === 'panel') {
      console.error('[AiNoteChat SDK] Chat container not found:', chatContainer);
      return { destroy: () => {} };
    }
  }

  destroy();

  // Dock 容器基础样式
  const baseStyle = {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    ...style,
  };
  Object.assign(targetEl.style, baseStyle);

  rootInstance = createRoot(targetEl);
  rootInstance.render(
    React.createElement(SdkChat, {
      appId,
      apiKey,
      host,
      themeColor,
      chatMode,
      chatContainerEl,
      dockPlacement,
      scenario,
      employeeIds,
      streamKey,
    }),
  );

  return { destroy };
}

/**
 * 销毁当前实例
 */
function destroy() {
  if (rootInstance) {
    rootInstance.unmount();
    rootInstance = null;
  }
  sdkEventBus.emit('destroy');
}

// ================================================================
// API 编程接口（纯 JS，无 UI，无需 init 即可独立使用）
// ================================================================

/**
 * 创建 API 客户端实例
 *
 * @param {object} config
 * @param {string} config.appId   - 应用 ID
 * @param {string} config.apiKey  - API Key
 * @param {string} [config.host]  - API 服务器地址
 * @returns {ApiClient}
 *
 * @example
 *   const api = AiNoteChat.api({ appId: 'xxx', apiKey: 'sk-...' });
 *   const employees = await api.getEmployees();
 *   await api.sendMessage({
 *     content: '你好，请帮我分析一下数据',
 *     employeeId: employees[0].id,
 *     onText: (delta, fullText) => {
 *       document.getElementById('output').textContent = fullText;
 *     },
 *     onDone: ({ conversationId, fullText }) => {
 *       console.log('对话完成', conversationId, fullText);
 *     },
 *   });
 */
function createApi(config = {}) {
  return new ApiClient(config);
}

// --- 导出到全局 ---
const AiNoteChat = {
  init,
  destroy,
  api: createApi,
  events: sdkEventBus,
};
window.AiNoteChat = AiNoteChat;

export { init, destroy, createApi };
