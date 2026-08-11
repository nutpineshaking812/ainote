import React, { useMemo, useEffect, useRef } from 'react';
import { Empty } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useAgentDock } from '../context/AgentDockContext';
import UnifiedChatWorkspace from './UnifiedChatWorkspace.jsx';
import { createChatDataProvider } from '../dataProviders/createChatDataProvider.js';
import { EMPLOYEE_SCENARIOS, getDisplayRole } from '../../../constants/employee';
import { useTranslation } from 'react-i18next';
import resourceEventBus from '../../../pages/app-detail/utils/resourceEventBus';

export function AgentWorkspace({
  minimized = false,
  onMinimizedChange,
  defaultDisplayMode = 'panel',
  onDisplayModeChange,
  initialReferences = [],
  appId = 'default',
  onAddChart,
}) {
  const {
    activeEmployee,
    sessionKey,
    targetId,
    scenario,
    allEmployees,
    appId: contextAppId,
    apiMode,
    summonEmployee,
    setActiveEmployee,
  } = useAgentDock();

  // 优先使用 context 中的 appId（open 模式由 AgentDockProvider 注入），降级为 props 传入
  const resolvedAppId = contextAppId || appId;
  const { t } = useTranslation();

  const pendingMessageRef = useRef(null);

  // Auto summon first available employee if none active when receiving send-message event
  useEffect(() => {
    const handleSendMessage = (params) => {
      const { message: msgText, metadata } = params;
      if (!msgText) return;

      if (!activeEmployee) {
        // Find matching employee for current scenario (or default GENERAL)
        const employeeToActivate =
          allEmployees.find((emp) => (emp.scenario || EMPLOYEE_SCENARIOS.GENERAL) === scenario) ||
          allEmployees[0];

        if (employeeToActivate) {
          pendingMessageRef.current = { msgText, metadata };
          summonEmployee(employeeToActivate);
          setActiveEmployee(employeeToActivate);
        } else {
          console.warn('[AgentWorkspace] No employees available to auto-summon');
        }
      }
    };

    resourceEventBus.on('chat:send-message', handleSendMessage);
    return () => {
      resourceEventBus.off('chat:send-message', handleSendMessage);
    };
  }, [activeEmployee, allEmployees, scenario, summonEmployee, setActiveEmployee]);

  // Re-emit pending message once employee becomes active and UnifiedChatWorkspace/ChatProvider is mounted
  useEffect(() => {
    if (activeEmployee && pendingMessageRef.current) {
      const { msgText, metadata } = pendingMessageRef.current;
      pendingMessageRef.current = null;
      // Delay slightly to ensure ChatProvider registers its listener
      const timer = setTimeout(() => {
        resourceEventBus.emit('chat:send-message', {
          message: msgText,
          metadata,
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeEmployee]);

  // All hooks MUST be called before any early returns (Rules of Hooks)

  // 2. 构造适合该员工的 prompts 快速点击指令列表
  const employeePrompts = useMemo(() => {
    const tools = activeEmployee?.metadata?.quickTools || [];
    return tools.map((tool) => ({
      label: tool.title,
      payload: tool.payload,
      data: {
        employeeId: activeEmployee?.id || activeEmployee?._id,
      },
    }));
  }, [activeEmployee]);

  // 3. DataProvider（策略模式）
  //    单一工厂调用，根据 apiMode 生产对应数据源。
  //    消费组件链（UnifiedChatWorkspace → ChatProvider → useConversationHistory）
  //    完全不需要感知模式差异。
  const dataProvider = useMemo(
    () =>
      createChatDataProvider(apiMode === 'open' ? 'open' : 'internal', {
        appId: resolvedAppId,
        employeeId: activeEmployee,
        targetId,
        scenario: scenario || EMPLOYEE_SCENARIOS.DOCUMENT,
      }),
    [apiMode, resolvedAppId, activeEmployee?.id, activeEmployee?._id, targetId, scenario],
  );

  // 1. 无激活数字人时，渲染精美工作台占位引导图（early return AFTER all hooks）
  if (!activeEmployee) {
    return;
  }

  // 4. 直接渲染高度内聚、开箱即用的门面工作区
  // console.log('%c[AgentWorkspace·DIAG] 渲染', 'color:#8b5cf6;font-weight:bold', {
  //   activeEmployeeId: activeEmployee?.id || activeEmployee?._id,
  //   sessionKey,
  //   requestPath,
  //   targetId,
  //   scenario,
  //   appId,
  //   hasLoadThreadsFn: true,
  // });
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <UnifiedChatWorkspace
        appId={resolvedAppId}
        dataProvider={dataProvider}
        sessionKey={sessionKey}
        scenario={scenario || EMPLOYEE_SCENARIOS.DOCUMENT}
        extraParams={{
          scenario,
          data: {
            scenario,
            targetId: targetId || undefined,
            employeeId: activeEmployee.id || activeEmployee._id,
          },
        }}
        title={activeEmployee.name}
        subTitle={getDisplayRole(activeEmployee.roleTitle, t) || '数字助理'}
        avatar={activeEmployee.avatar}
        prompts={employeePrompts}
        welcome={
          activeEmployee.metadata?.welcomePrompt ||
          `你好！我是你的数字助理 ${activeEmployee.name}。`
        }
        minimized={minimized}
        onMinimizedChange={onMinimizedChange}
        showMinimizeAction
        showBubbleWhenMinimized={false}
        bubbleLabel={activeEmployee.name}
        modes={['panel', 'fullscreen', 'floating']}
        defaultDisplayMode={defaultDisplayMode}
        onDisplayModeChange={onDisplayModeChange}
        senderPlaceholder={`向 ${activeEmployee.name} 发送消息...`}
        initialReferences={initialReferences}
        onAddChart={onAddChart}
      />
    </div>
  );
}

export default AgentWorkspace;
