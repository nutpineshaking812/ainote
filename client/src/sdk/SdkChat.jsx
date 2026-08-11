import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ConfigProvider, App, theme } from 'antd';
import { AuthProvider } from '../store/AuthContext';
import { AgentDockProvider, useAgentDock } from '../features/chat/context/AgentDockContext';
import { AgentDock } from '../features/chat/components/AgentDock';
import { AgentWorkspace } from '../features/chat/components/AgentWorkspace';
import { EMPLOYEE_SCENARIOS } from '../constants/employee';
import api from '../api';
import sdkEventBus from './sdkEventBus';
import resourceEventBus from '../pages/app-detail/utils/resourceEventBus';

// ================================================================
// 事件观察者组件 — 将内部状态变化转换为 sdkEventBus 事件，供宿主页面订阅
// ================================================================

/**
 * 数据观察者：侦听 AgentDockContext 的 employee 相关变化
 */
function DataObserver() {
  const { activeEmployee, dockEmployees, allEmployees, loading } = useAgentDock();

  // 员工列表加载完成
  useEffect(() => {
    if (!loading && allEmployees.length > 0) {
      sdkEventBus.emit('employee:list', allEmployees);
    }
  }, [loading, allEmployees]);

  // 员工选中 / 切换
  const prevRef = React.useRef(null);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = activeEmployee;

    if (activeEmployee && activeEmployee !== prev) {
      sdkEventBus.emit('employee:select', activeEmployee);
    }
    if (!activeEmployee && prev) {
      sdkEventBus.emit('employee:dismiss', prev);
    }
  }, [activeEmployee]);

  return null;
}

/**
 * 事件桥接：将内部 resourceEventBus 的聊天事件转发到 sdkEventBus
 */
function ResourceEventBridge() {
  useEffect(() => {
    const handleSendMessage = (params) => {
      const content = params?.message || params?.content || '';
      sdkEventBus.emit('chat:send', { content, employeeId: params?.employeeId, metadata: params?.metadata });
    };

    const handleStreamDone = (data) => {
      sdkEventBus.emit('chat:stream:done', data);
    };

    const handleStreamAbort = (data) => {
      sdkEventBus.emit('chat:stream:abort', data);
    };

    // 核心：将对话过程中的每一个 SSE 事件转发到 sdkEventBus
    // 宿主页面通过 AiNoteChat.events.on('stream:event', ({ type, data }) => { ... }) 监听
    // type 包括: text-delta, thinking-delta, stage, tool-input-start, tool-input-delta,
    //   tool-input-available, tool-result, tool-output-available, finish, error, chart, data
    //   以及未来流程编排中的自定义节点事件
    const handleStreamEvent = (payload) => {
      sdkEventBus.emit('stream:event', payload);
    };

    resourceEventBus.on('chat:send-message', handleSendMessage);
    resourceEventBus.on('chat:stream:done', handleStreamDone);
    resourceEventBus.on('chat:stream:abort', handleStreamAbort);
    resourceEventBus.on('stream:event', handleStreamEvent);

    return () => {
      resourceEventBus.off('chat:send-message', handleSendMessage);
      resourceEventBus.off('chat:stream:done', handleStreamDone);
      resourceEventBus.off('chat:stream:abort', handleStreamAbort);
      resourceEventBus.off('stream:event', handleStreamEvent);
    };
  }, []);

  return null;
}

/**
 * Workspace 渲染器 —— 根据 chatMode 决定渲染位置
 * - 'panel' 模式：通过 Portal 渲染到 chatContainerEl 中（侧栏/嵌入）
 * - 'floating' / 'fullscreen' 模式：内联渲染，让 ChatAssistant 的 Portal 机制接管
 *
 * 同时监听 minimize 事件，关闭时取消选中员工
 */
function WorkspaceRenderer({ appId, chatMode, chatContainerEl }) {
  const { activeEmployee, setActiveEmployee } = useAgentDock();

  const handleMinimizedChange = useCallback((next) => {
    if (next) {
      setActiveEmployee(null);
    }
  }, [setActiveEmployee]);

  const isPanel = chatMode === 'panel';

  // panel模式下未选员工 → 不渲染，侧栏容器保持空白
  if (isPanel && !activeEmployee) {
    return null;
  }

  const modes = isPanel ? ['panel'] : ['floating', 'fullscreen'];

  const workspace = (
    <AgentWorkspace
      appId={appId}
      defaultDisplayMode={chatMode}
      modes={modes}
      onMinimizedChange={handleMinimizedChange}
    />
  );

  // panel 模式：Portal 到用户指定的侧栏容器
  if (isPanel && chatContainerEl) {
    return createPortal(workspace, chatContainerEl);
  }

  // floating / fullscreen 模式：内联渲染，ChatAssistant 内部会 Portal 到 body
  return workspace;
}

/**
 * SDK 聊天根组件
 *
 * Dock（悬浮按钮）与 Chat（聊天面板）分离设计：
 * - Dock 渲染在用户指定的 container 中（通常固定在页面右侧）
 * - Chat 支持三种模式：
 *   · 'floating'（默认）：Portal 到 body 的浮动窗口
 *   · 'fullscreen'：Portal 到 body 的全屏遮罩
 *   · 'panel'：Portal 到 chatContainer 指定的侧栏容器
 *
 * 鉴权流程：API Key → POST /open/apps/:appId/session → 获取 JWT → 存入 localStorage
 *
 * @param {object} props
 * @param {string} props.appId        - 应用 ID（必填）
 * @param {string} props.apiKey       - API Key（必填）
 * @param {string} [props.host]       - API 服务器地址
 * @param {string} [props.themeColor] - 主题色，默认 #6366f1
 * @param {string} [props.scenario]   - 员工场景，默认 GENERAL
 * @param {string[]} [props.employeeIds] - 可选：只展示指定 ID 的员工，默认展示全部
 * @param {string} [props.chatMode]   - 聊天面板模式：'floating' | 'fullscreen' | 'panel'，默认 'floating'
 * @param {Element} [props.chatContainerEl] - panel 模式下的侧栏容器 DOM 元素
 * @param {string} [props.dockPlacement] - Dock 位置 'left' | 'right'，默认 'right'
 */
export default function SdkChat({
  appId,
  apiKey,
  host = '',
  themeColor = '#6366f1',
  scenario = EMPLOYEE_SCENARIOS.GENERAL,
  employeeIds,
  streamKey,
  chatMode = 'floating',
  chatContainerEl = null,
  dockPlacement = 'right',
}) {
  const [authState, setAuthState] = useState({
    loading: true,
    error: null,
    userId: null,
  });

  // 计算 API base URL
  const apiBase = useMemo(() => {
    if (host) return host.replace(/\/+$/, '');
    // 同源模式：使用相对路径
    return '';
  }, [host]);

  // 鉴权：用 API Key 换取 JWT Session
  useEffect(() => {
    if (!appId || !apiKey) {
      setAuthState({ loading: false, error: '缺少必要参数：appId 或 apiKey', userId: null });
      return;
    }

    let cancelled = false;

    const initSession = async () => {
      const sessionUrl = apiBase
        ? `${apiBase}/api/v1/open/apps/${appId}/session`
        : `/api/v1/open/apps/${appId}/session`;

      try {
        const res = await fetch(sessionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({}),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || json.error || 'Session 创建失败');
        }

        const { token, userId: sessionUserId } = json.data;

        // 将 JWT 存入 localStorage，后续所有 API/SSE 请求自动携带
        localStorage.setItem('token', token);

        // 若指定了 host，改写 axios baseURL，确保后续聊天 API 请求也走正确域名
        if (apiBase) {
          api.defaults.baseURL = `${apiBase}/api/v1`;
        }

        if (!cancelled) {
          setAuthState({ loading: false, error: null, userId: sessionUserId });
          sdkEventBus.emit('ready', { userId: sessionUserId, token });
        }
      } catch (err) {
        const errMsg = err.message || '鉴权失败，请检查 API Key 是否有效';
        if (!cancelled) {
          setAuthState({
            loading: false,
            error: errMsg,
            userId: null,
          });
        }
        sdkEventBus.emit('auth:error', { message: errMsg });
      }
    };

    initSession();

    return () => {
      cancelled = true;
    };
  }, [appId, apiKey, apiBase]);

  // 自定义主题
  const customTheme = useMemo(() => ({
    token: {
      colorPrimary: themeColor,
      colorPrimaryHover: themeColor,
      colorPrimaryActive: themeColor,
      colorPrimaryBg: `${themeColor}15`,
    },
  }), [themeColor]);

  // 鉴权中 / 鉴权失败 / 缺少参数 → 静默，不渲染任何 UI
  // 宿主页面通过 sdkEventBus 订阅 'ready' / 'auth:error' 自行处理状态
  if (authState.loading || authState.error || !appId) {
    return null;
  }

  // 鉴权成功 — Dock 与 Chat 分离渲染
  return (
    <AuthProvider>
      <ConfigProvider
        theme={customTheme}
        getPopupContainer={(trigger) => trigger?.parentElement || document.body}
      >
      <App>
        {/* 事件桥接：将内部 resourceEventBus 聊天事件转发到 sdkEventBus */}
        <ResourceEventBridge />
        <AgentDockProvider
          appId={appId}
          targetId={appId}
          scenario={scenario}
          externalUserId={authState.userId}
          apiMode="open"
          employeeIds={employeeIds}
          streamKey={streamKey}
        >
          {/* 数据观察者：侦听 AgentDockContext 变化，发射 employee 事件 */}
          <DataObserver />
          {/* Dock 悬浮按钮 — 渲染在当前容器中（用户决定位置） */}
          <AgentDock placement={dockPlacement} />

          {/* 聊天面板 — 根据模式决定渲染位置 */}
          <WorkspaceRenderer
            appId={appId}
            chatMode={chatMode}
            chatContainerEl={chatContainerEl}
          />
        </AgentDockProvider>
      </App>
    </ConfigProvider>
  </AuthProvider>
  );
}
