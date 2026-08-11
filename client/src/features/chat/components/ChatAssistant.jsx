import React, { useMemo, useState, useEffect, useRef, useCallback, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Drawer, Badge, ConfigProvider } from 'antd';
import { CommentOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ConversationList from './ConversationList.jsx';
import { useChat } from '../context/ChatProvider.jsx';
import { AgentDockContext } from '../context/AgentDockContext.jsx';

// 导入原子化积木组件
import ChatHeader, { DISPLAY_MODES } from './ChatHeader.jsx';
import ChatViewport from './ChatViewport.jsx';
import ChatFooter from './ChatFooter.jsx';

export { DISPLAY_MODES };

export function ChatAssistant({
  appId,
  title,
  subTitle,  // 新增：支持头部子标题
  avatar,    // 新增：支持个性化头像
  status,    // 新增：支持活跃状态
  prompts = [],
  quickTools = [],
  welcome,
  renderAboveMessages,
  renderSender, // ({ onSend, disabled, loading }) => ReactNode
  drawerWidth = 320,
  senderPlaceholder,
  defaultMinimized = false, // 初始是否最小化为气泡
  minimized: controlledMinimized,
  onMinimizedChange,
  bubbleSize = 56,
  bubbleOffset = { right: 24, bottom: 80 },
  showBubbleWhenMinimized = true,
  showMinimizeAction = true,
  bubbleLabel,
  bubbleTooltip,
  onAddChart,
  defaultDisplayMode = DISPLAY_MODES.PANEL,
  onDisplayModeChange,
  modes = Object.values(DISPLAY_MODES),
  initialReferences = [],
}) {
  const { t } = useTranslation();
  const {
    threads,
    loadingThreads,
    activeKey,
    setActiveKey,
    loadMessages,
    createPlaceholderThread,
    mergedMessages,
    streamLoading,
    startStream,
    setConversationId,
    hasHistory,
    abort,
  } = useChat();

  const dockCtx = useContext(AgentDockContext);

  const assistantRef = useRef(null);
  const [threadsOpen, setThreadsOpen] = useState(false);
  const allModes = Object.values(DISPLAY_MODES);
  const allowedModes = useMemo(() => {
    if (!Array.isArray(modes) || modes.length === 0) return allModes;
    const filtered = modes.filter((mode) => allModes.includes(mode));
    return filtered.length ? filtered : allModes;
  }, [modes]);

  const [displayMode, setDisplayMode] = useState(() => {
    const fallbackMode = allowedModes[0] || DISPLAY_MODES.PANEL;
    return allowedModes.includes(defaultDisplayMode) ? defaultDisplayMode : fallbackMode;
  });

  const isControlledMinimized = typeof controlledMinimized === 'boolean';
  const [internalMinimized, setInternalMinimized] = useState(defaultMinimized);

  const finalTitle = title || t('aiChat.title');
  const finalSenderPlaceholder = senderPlaceholder || t('chatAssistant.senderPlaceholder');
  const finalBubbleLabel = bubbleLabel || t('chatAssistant.bubbleLabel');
  const finalBubbleTooltip = bubbleTooltip || t('chatAssistant.bubbleTooltip');

  const minimized = isControlledMinimized ? controlledMinimized : internalMinimized;
  const [unreadCount, setUnreadCount] = useState(0);

  // 可拖动气泡位置控制
  const [bubbleY, setBubbleY] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight - bubbleSize - bubbleOffset.bottom : 0
  );
  const [bubbleX, setBubbleX] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth - bubbleSize - bubbleOffset.right : 0
  );
  const dragStateRef = useRef({
    dragging: false,
    startY: 0,
    startX: 0,
    originY: bubbleY,
    originX: bubbleX,
    moved: false,
  });
  const prevMsgLenRef = useRef(mergedMessages.length);
  const prevDefaultModeRef = useRef(defaultDisplayMode);

  useEffect(() => {
    if (!isControlledMinimized) {
      setInternalMinimized(defaultMinimized);
    }
  }, [defaultMinimized, isControlledMinimized]);

  const updateMinimized = useCallback(
    (next) => {
      if (next === minimized) return;
      if (!isControlledMinimized) {
        setInternalMinimized(next);
      }
      onMinimizedChange?.(next);
    },
    [isControlledMinimized, minimized, onMinimizedChange]
  );

  // 未读计数：在最小化状态下收到新消息则加一，同步更新到 AgentDock 对应员工上
  useEffect(() => {
    const currentLen = mergedMessages.length;
    if (minimized && currentLen > prevMsgLenRef.current) {
      const diff = currentLen - prevMsgLenRef.current;
      setUnreadCount((c) => c + diff);
      if (dockCtx && dockCtx.activeEmployee && dockCtx.incrementUnreadCount) {
        const empId = dockCtx.activeEmployee.id || dockCtx.activeEmployee._id;
        for (let i = 0; i < diff; i++) {
          dockCtx.incrementUnreadCount(empId);
        }
      }
    }
    prevMsgLenRef.current = currentLen;
  }, [mergedMessages, minimized, dockCtx]);

  // 当打开聊天窗口（最小化状态解除）或切换为当前激活员工时，自动清空其未读消息数
  useEffect(() => {
    if (!minimized && dockCtx && dockCtx.activeEmployee && dockCtx.clearUnreadCount) {
      const empId = dockCtx.activeEmployee.id || dockCtx.activeEmployee._id;
      dockCtx.clearUnreadCount(empId);
    }
  }, [minimized, dockCtx?.activeEmployee?.id, dockCtx?.activeEmployee?._id, dockCtx]);

  const handleMinimize = () => {
    updateMinimized(true);
  };

  const restoreFromBubble = () => {
    updateMinimized(false);
    setUnreadCount(0);
  };

  const handleSend = (text, metadata = {}) => {
    if (!text || (typeof text === 'string' && !text.trim()) || (Array.isArray(text) && text.length === 0)) return;

    const metadataRefs = Array.isArray(metadata?.refs) ? metadata.refs : [];
    const templateRefs = initialReferences.map((item) => ({
      label: item.label,
      id: item.value,
      type: item.type,
    }));
    const mergedRefs = [];
    const seenKeys = new Set();
    const pushRef = (ref) => {
      if (!ref) return;
      const key = `${ref.type || ''}:${ref.id || ref.label || ''}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      mergedRefs.push(ref);
    };
    metadataRefs.forEach(pushRef);
    templateRefs.forEach(pushRef);
    startStream(text, {
      ...metadata,
      appId,
      refs: mergedRefs,
    });
  };

  const handleDisplayModeChange = (nextMode) => {
    if (!allowedModes.includes(nextMode)) return;
    updateMinimized(false);
    if (nextMode === displayMode) return;
    setDisplayMode(nextMode);
    onDisplayModeChange?.(nextMode);
  };

  useEffect(() => {
    const fallbackMode = allowedModes[0] || DISPLAY_MODES.PANEL;
    const preferredMode = allowedModes.includes(defaultDisplayMode)
      ? defaultDisplayMode
      : fallbackMode;
    const defaultModeChanged = prevDefaultModeRef.current !== defaultDisplayMode;
    prevDefaultModeRef.current = defaultDisplayMode;

    if (!allowedModes.includes(displayMode)) {
      updateMinimized(false);
      setDisplayMode(preferredMode);
      onDisplayModeChange?.(preferredMode);
      return;
    }

    if (defaultModeChanged && displayMode !== preferredMode) {
      updateMinimized(false);
      setDisplayMode(preferredMode);
      onDisplayModeChange?.(preferredMode);
    }
  }, [allowedModes, defaultDisplayMode, displayMode, onDisplayModeChange, updateMinimized]);

  // 绑定拖动事件
  useEffect(() => {
    if (!minimized) return;
    const handleMouseMove = (e) => {
      if (!dragStateRef.current.dragging) return;
      const deltaY = e.clientY - dragStateRef.current.startY;
      const deltaX = e.clientX - dragStateRef.current.startX;
      if (Math.abs(deltaY) > 2 || Math.abs(deltaX) > 2) dragStateRef.current.moved = true;
      let nextY = dragStateRef.current.originY + deltaY;
      let nextX = dragStateRef.current.originX + deltaX;
      const maxY = window.innerHeight - bubbleSize - 12;
      const maxX = window.innerWidth - bubbleSize - 12;
      if (nextY < 12) nextY = 12;
      if (nextY > maxY) nextY = maxY;
      if (nextX < 12) nextX = 12;
      if (nextX > maxX) nextX = maxX;
      setBubbleY(nextY);
      setBubbleX(nextX);
    };

    const handleMouseUp = () => {
      if (!dragStateRef.current.dragging) return;
      dragStateRef.current.dragging = false;
      if (!dragStateRef.current.moved) {
        restoreFromBubble();
      } else {
        const centerX = bubbleX + bubbleSize / 2;
        const windowCenter = window.innerWidth / 2;
        const targetX = centerX < windowCenter ? 12 : window.innerWidth - bubbleSize - 24;
        setBubbleX(targetX);
      }
      dragStateRef.current.moved = false;
    };

    const handleResize = () => {
      setBubbleY((y) => Math.min(y, window.innerHeight - bubbleSize - 12));
      setBubbleX((x) => Math.min(x, window.innerWidth - bubbleSize - 12));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
    };
  }, [minimized, bubbleSize, bubbleX]);

  const startDrag = (e) => {
    e.preventDefault();
    dragStateRef.current.dragging = true;
    dragStateRef.current.startY = e.clientY;
    dragStateRef.current.startX = e.clientX;
    dragStateRef.current.originY = bubbleY;
    dragStateRef.current.originX = bubbleX;
    dragStateRef.current.moved = false;
  };

  const isPanelMode = displayMode === DISPLAY_MODES.PANEL;

  // 1. 悬浮气泡渲染
  if (minimized) {
    if (!showBubbleWhenMinimized) return null;
    return (
      <div
        style={{
          position: 'fixed',
          left: bubbleX,
          top: bubbleY,
          right: 0,
          width: bubbleSize,
          height: bubbleSize,
          borderRadius: bubbleSize,
          background: 'linear-gradient(135deg,#6366f1 0%, #8b5cf6 60%, #a855f7 100%)',
          boxShadow: '0 6px 18px rgba(99,102,241,0.4), 0 0 0 4px rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 1000,
          userSelect: 'none',
          transition: dragStateRef.current.dragging
            ? 'none'
            : 'top 0.15s ease, left 0.15s ease, box-shadow 0.6s',
        }}
        onMouseDown={startDrag}
        title={finalBubbleTooltip || undefined}
      >
        <Badge count={unreadCount} size="small" offset={[0, 4]}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              paddingTop: 2,
            }}
          >
            <CommentOutlined
              style={{
                fontSize: bubbleSize * 0.37,
                color: 'rgba(255,255,255,0.9)',
                marginBottom: 3,
              }}
            />
            <div
              style={{
                fontSize: bubbleSize * 0.18,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '1px',
                textShadow: '0 2px 4px rgba(0,0,0,0.25)',
              }}
            >
              {finalBubbleLabel}
            </div>
          </div>
        </Badge>
      </div>
    );
  }

  // 2. 主座舱面板结构（由原子组件搭建而成）
  const assistantBody = (
    <ConfigProvider
      getPopupContainer={() => assistantRef.current || document.body}
    >
      <div
        ref={assistantRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          border: '1px solid #f0f0f0',
          borderRadius: displayMode === DISPLAY_MODES.PANEL ? 0 : 12,
          background: '#fff',
          position: 'relative',
        }}
      >
        {/* 原子头部：控制布局与历史会话 */}
        <ChatHeader
          title={finalTitle}
          subTitle={subTitle}
          avatar={avatar}
          status={status || (streamLoading ? 'streaming' : 'online')}
          displayMode={displayMode}
          allowedModes={allowedModes}
          onDisplayModeChange={handleDisplayModeChange}
          hasHistory={hasHistory}
          threads={threads}
          loadingThreads={loadingThreads}
          activeKey={activeKey}
          onActiveThreadChange={(key) => {
            setActiveKey(key);
            setConversationId(key);
            loadMessages(key);
          }}
          onNewThread={() => {
            createPlaceholderThread();
            setConversationId(null);
          }}
          onOpenHistoryDrawer={() => setThreadsOpen(true)}
          onMinimize={handleMinimize}
          showMinimizeAction={showMinimizeAction}
        />

        {/* 原子视口：消息列表与欢迎引导区 */}
        <ChatViewport
          messages={mergedMessages}
          streamLoading={streamLoading}
          onAddChart={onAddChart}
          title={finalTitle}
          welcome={welcome}
          prompts={prompts}
          onPromptClick={handleSend}
          renderAboveMessages={renderAboveMessages}
          assistantAvatar={avatar}
          assistantName={title}
          displayMode={displayMode}
        />

        {/* 原子尾部：输入面板与快捷 Prompt 芯片 */}
        <ChatFooter
          quickTools={quickTools}
          onQuickToolClick={handleSend}
          streamLoading={streamLoading}
          abort={abort}
          onSend={handleSend}
          senderPlaceholder={finalSenderPlaceholder}
          appId={appId}
          initialReferences={initialReferences}
          renderSender={renderSender}
        />

        {/* 原子会话 Drawer 列表（仅在面板侧边栏且有历史时生效） */}
        {isPanelMode && hasHistory && (
          <Drawer
            title={t('chatAssistant.conversationListTitle', { title: finalTitle })}
            open={threadsOpen}
            size={drawerWidth}
            onClose={() => setThreadsOpen(false)}
            placement="right"
            destroyOnClose
          >
            <ConversationList
              threads={threads}
              loading={loadingThreads}
              activeKey={activeKey}
              onActiveChange={(key) => {
                setActiveKey(key);
                setConversationId(key);
                loadMessages(key);
                setThreadsOpen(false);
              }}
              onNewThread={() => {
                createPlaceholderThread();
                setConversationId(null);
                setThreadsOpen(false);
              }}
            />
          </Drawer>
        )}
      </div>
    </ConfigProvider>
  );

  const renderPortal = (node) => {
    if (typeof document === 'undefined') return null;
    return createPortal(node, document.body);
  };

  // 3. 各种布局容器分发
  if (displayMode === DISPLAY_MODES.FLOATING) {
    return renderPortal(
      <div
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          width: 420,
          height: 540,
          zIndex: 1200,
          boxShadow: '0 20px 45px rgba(15,23,42,0.35)',
          borderRadius: 16,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        {assistantBody}
      </div>
    );
  }

  if (displayMode === DISPLAY_MODES.FULL) {
    return renderPortal(
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1400,
          background: 'rgba(15, 23, 42, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            width: 'min(1200px, 90vw)',
            height: 'min(840px, 90vh)',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 30px 65px rgba(15,23,42,0.35)',
          }}
        >
          {assistantBody}
        </div>
      </div>
    );
  }

  return assistantBody;
}

export default ChatAssistant;
