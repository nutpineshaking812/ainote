import React from 'react';
import { Spin } from 'antd';
import ChatProvider from '../context/ChatProvider.jsx';
import ChatAssistant, { DISPLAY_MODES } from './ChatAssistant.jsx';

export { DISPLAY_MODES };

export function UnifiedChatWorkspace({
  // ---- 1. Provider 数据流核心配置 ----
  dataProvider,       // DataProvider 对象（策略模式）：{ requestPath, loadThreads, loadMessages }
  sessionKey,
  scenario = 'GENERAL',
  enabled = true,
  extraParams = {},

  // ---- 2. UI 展现层与组件偏好配置 ----
  appId,
  title,
  subTitle,  // 新增：支持头部子标题
  avatar,    // 新增：支持个性化头像
  status,    // 新增：支持活跃状态
  prompts = [],
  quickTools = [],
  welcome,
  renderAboveMessages,
  renderSender,
  drawerWidth = 320,
  senderPlaceholder,
  minimized = false,
  onMinimizedChange,
  showMinimizeAction = true,
  showBubbleWhenMinimized = true,
  bubbleLabel,
  bubbleTooltip,
  onAddChart,
  defaultDisplayMode = DISPLAY_MODES.PANEL,
  onDisplayModeChange,
  modes = Object.values(DISPLAY_MODES),
  initialReferences = [],
}) {
  return (
    <ChatProvider
      // 内部利用动态组合 Key 进行线程安全隔离，当接口端点或会话密钥变更时，自动进行重载重置，外部开发者零心智负担
      key={`unified-convo-prov-${dataProvider?.requestPath || ''}-${sessionKey}`}
      dataProvider={dataProvider}
      placeholderKey={sessionKey}
      scenario={scenario}
      enabled={enabled}
      extraParams={extraParams}
    >
      <React.Suspense
        fallback={
          <div style={{ display: 'flex', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <Spin size="large" />
          </div>
        }
      >
        <ChatAssistant
          appId={appId}
          title={title}
          subTitle={subTitle}
          avatar={avatar}
          status={status}
          prompts={prompts}
          quickTools={quickTools}
          welcome={welcome}
          renderAboveMessages={renderAboveMessages}
          renderSender={renderSender}
          drawerWidth={drawerWidth}
          senderPlaceholder={senderPlaceholder}
          minimized={minimized}
          onMinimizedChange={onMinimizedChange}
          showMinimizeAction={showMinimizeAction}
          showBubbleWhenMinimized={showBubbleWhenMinimized}
          bubbleLabel={bubbleLabel}
          bubbleTooltip={bubbleTooltip}
          onAddChart={onAddChart}
          defaultDisplayMode={defaultDisplayMode}
          onDisplayModeChange={onDisplayModeChange}
          modes={modes}
          initialReferences={initialReferences}
        />
      </React.Suspense>
    </ChatProvider>
  );
}

export default UnifiedChatWorkspace;
