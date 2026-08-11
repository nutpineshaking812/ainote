import React, { useMemo, useRef } from 'react';
import { Button, Space, Typography, Tooltip, Avatar, Badge, theme, Dropdown } from 'antd';
import {
  FullscreenOutlined,
  FullscreenExitOutlined,
  CommentOutlined,
  GatewayOutlined,
  PlusOutlined,
  UnorderedListOutlined,
  CloseOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import HistoryDropdown from './HistoryDropdown.jsx';

const { Text } = Typography;

export const DISPLAY_MODES = {
  PANEL: 'panel',
  FLOATING: 'floating',
  FULL: 'fullscreen',
};

export function ChatHeader({
  title,
  subTitle,
  avatar,
  status = 'online', // 'online' | 'busy' | 'streaming' | 'idle'
  displayMode = DISPLAY_MODES.PANEL,
  allowedModes = Object.values(DISPLAY_MODES),
  onDisplayModeChange,
  hasHistory = false,
  threads = [],
  loadingThreads = false,
  activeKey,
  onActiveThreadChange,
  onNewThread,
  onOpenHistoryDrawer,
  onMinimize,
  showMinimizeAction = true,
}) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const isPanelMode = displayMode === DISPLAY_MODES.PANEL;
  const containerRef = useRef(null);

  const handleDisplayModeChange = (nextMode) => {
    if (!allowedModes.includes(nextMode)) return;
    onDisplayModeChange?.(nextMode);
  };

  const currentModeIcon = useMemo(() => {
    switch (displayMode) {
      case DISPLAY_MODES.PANEL:
        return <CommentOutlined style={{ fontSize: 15 }} />;
      case DISPLAY_MODES.FLOATING:
        return <GatewayOutlined style={{ fontSize: 15 }} />;
      case DISPLAY_MODES.FULL:
        return <FullscreenOutlined style={{ fontSize: 15 }} />;
      default:
        return <CommentOutlined style={{ fontSize: 15 }} />;
    }
  }, [displayMode]);

  const currentModeLabel = useMemo(() => {
    switch (displayMode) {
      case DISPLAY_MODES.PANEL:
        return t('chatAssistant.sidebarMode');
      case DISPLAY_MODES.FLOATING:
        return t('chatAssistant.floatingWindow');
      case DISPLAY_MODES.FULL:
        return t('chatAssistant.fullscreenChat');
      default:
        return '';
    }
  }, [displayMode, t]);

  const layoutMenuItems = useMemo(() => {
    return allowedModes
      .filter((mode) => mode !== displayMode)
      .map((mode) => {
        let icon = <CommentOutlined />;
        let label = t('chatAssistant.sidebarMode');
        if (mode === DISPLAY_MODES.FLOATING) {
          icon = <GatewayOutlined />;
          label = t('chatAssistant.floatingWindow');
        } else if (mode === DISPLAY_MODES.FULL) {
          icon = <FullscreenOutlined />;
          label = t('chatAssistant.fullscreenChat');
        }
        return {
          key: mode,
          icon,
          label,
        };
      });
  }, [allowedModes, displayMode, t]);

  // 动态渲染状态指示器（带呼吸灯动效）
  const renderStatusIndicator = () => {
    let color = '#52c41a'; // 绿色 (Online)
    let label = '在线';
    let isPulsing = true;

    if (status === 'busy' || status === 'streaming') {
      color = '#1890ff'; // 蓝色 (Active)
      label = status === 'streaming' ? '正在思考/回复...' : '繁忙';
    } else if (status === 'idle') {
      color = '#faad14'; // 黄色 (Idle)
      label = '空闲';
      isPulsing = false;
    }

    return (
      <Space size={4} style={{ display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ position: 'relative', display: 'inline-flex', width: 6, height: 6 }}>
          {isPulsing && (
            <span
              style={{
                position: 'absolute',
                display: 'inline-flex',
                height: '100%',
                width: '100%',
                borderRadius: '50%',
                backgroundColor: color,
                opacity: 0.75,
                animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
              }}
            />
          )}
          <span
            style={{
              position: 'relative',
              display: 'inline-flex',
              borderRadius: '50%',
              width: 6,
              height: 6,
              backgroundColor: color,
            }}
          />
        </span>
        <Text style={{ fontSize: '10px', color: token.colorTextDescription }} type="secondary">
          {label}
        </Text>
      </Space>
    );
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, #ffffff 100%)',
        backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        borderTopLeftRadius: displayMode === DISPLAY_MODES.PANEL ? 0 : 12,
        borderTopRightRadius: displayMode === DISPLAY_MODES.PANEL ? 0 : 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        flexShrink: 0,
        // zIndex: 1200
      }}
    >
      {/* 动画关键帧 CSS */}
      <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
        .header-action-btn {
          border: none !important;
          background: transparent !important;
          color: #64748b !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          border-radius: 8px !important;
          width: 32px !important;
          height: 32px !important;
          padding: 0 !important;
        }
        .header-action-btn:hover {
          background: rgba(100, 116, 139, 0.08) !important;
          color: #1e293b !important;
          transform: scale(1.05);
        }
        .header-action-btn-active {
          background: rgba(99, 102, 241, 0.08) !important;
          color: #6366f1 !important;
        }
      `}</style>

      {/* 左侧：拟人化头像与活跃状态 */}
      <Space size={10} align="center" style={{ minWidth: 0, flex: 1, marginRight: '12px' }}>
        <Avatar
          src={avatar || undefined}
          size={36}
          style={{
            border: '2px solid #fff',
            boxShadow: '0 2px 10px rgba(99, 102, 241, 0.15)',
            backgroundColor: !avatar ? token.colorPrimary : 'transparent',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            flexShrink: 0,
          }}
        >
          {!avatar && (title?.[0] || '✦')}
        </Avatar>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            lineHeight: 1.2,
            minWidth: 0,
            flex: 1,
          }}
        >
          <Text
            ellipsis
            style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', display: 'block' }}
          >
            {title || t('aiChat.title')}
          </Text>
          <Space
            size={6}
            style={{ marginTop: '2px', flexWrap: 'nowrap', overflow: 'hidden', width: '100%' }}
          >
            {subTitle && (
              <Text
                ellipsis
                style={{
                  fontSize: '10.5px',
                  color: '#64748b',
                  fontWeight: 500,
                  maxWidth: 90,
                  display: 'block',
                }}
              >
                {subTitle}
              </Text>
            )}
            {subTitle && (
              <span
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  background: '#cbd5e1',
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flexShrink: 0 }}>{renderStatusIndicator()}</div>
          </Space>
        </div>
      </Space>

      {/* 右侧：高度整合的 Control Toolbar */}
      <Space size={4} align="center" style={{ flexShrink: 0 }}>
        {/* 智能布局模式切换 */}
        {allowedModes.length > 1 &&
          (displayMode === DISPLAY_MODES.FULL ? (
            // 全屏模式，空间极其充裕，展示平铺按钮以便“一键还原/一键切换”
            <>
              {allowedModes.includes(DISPLAY_MODES.PANEL) && (
                <Tooltip title={t('chatAssistant.sidebarMode')} mouseEnterDelay={0.4}>
                  <Button
                    className={`header-action-btn`}
                    size="middle"
                    icon={<CommentOutlined style={{ fontSize: 15 }} />}
                    onClick={() => handleDisplayModeChange(DISPLAY_MODES.PANEL)}
                  />
                </Tooltip>
              )}
              {allowedModes.includes(DISPLAY_MODES.FLOATING) && (
                <Tooltip
                  title={
                    displayMode === DISPLAY_MODES.FLOATING
                      ? t('chatAssistant.exitFloating')
                      : t('chatAssistant.floatingWindow')
                  }
                  mouseEnterDelay={0.4}
                >
                  <Button
                    className={`header-action-btn ${displayMode === DISPLAY_MODES.FLOATING ? 'header-action-btn-active' : ''}`}
                    size="middle"
                    icon={<GatewayOutlined style={{ fontSize: 15 }} />}
                    onClick={() => {
                      if (displayMode === DISPLAY_MODES.FLOATING) {
                        handleDisplayModeChange(DISPLAY_MODES.PANEL);
                      } else {
                        handleDisplayModeChange(DISPLAY_MODES.FLOATING);
                      }
                    }}
                  />
                </Tooltip>
              )}
              {allowedModes.includes(DISPLAY_MODES.FULL) && (
                <Tooltip
                  title={
                    displayMode === DISPLAY_MODES.FULL
                      ? t('chatAssistant.exitFullscreen')
                      : t('chatAssistant.fullscreenChat')
                  }
                  mouseEnterDelay={0.4}
                >
                  <Button
                    className={`header-action-btn ${displayMode === DISPLAY_MODES.FULL ? 'header-action-btn-active' : ''}`}
                    size="middle"
                    icon={
                      displayMode === DISPLAY_MODES.FULL ? (
                        <FullscreenExitOutlined style={{ fontSize: 15 }} />
                      ) : (
                        <FullscreenOutlined style={{ fontSize: 15 }} />
                      )
                    }
                    onClick={() => {
                      if (displayMode === DISPLAY_MODES.FULL) {
                        handleDisplayModeChange(DISPLAY_MODES.PANEL);
                      } else {
                        handleDisplayModeChange(DISPLAY_MODES.FULL);
                      }
                    }}
                  />
                </Tooltip>
              )}
            </>
          ) : (
            // 侧边栏 (panel) 或 浮动窗口 (floating) 模式，空间局促，使用收纳式 Dropdown 单按钮，释放排版压力
            <Tooltip title={`当前模式: ${currentModeLabel}`} mouseEnterDelay={0.4}>
              <Dropdown
                menu={{
                  items: layoutMenuItems,
                  onClick: ({ key }) => handleDisplayModeChange(key),
                }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button
                  className="header-action-btn header-action-btn-active"
                  size="middle"
                  icon={currentModeIcon}
                />
              </Dropdown>
            </Tooltip>
          ))}

        {/* 新建会话 */}
        {hasHistory && (
          <Tooltip title={t('chatAssistant.newConversation')} mouseEnterDelay={0.4}>
            <Button
              className="header-action-btn"
              size="middle"
              icon={<PlusOutlined style={{ fontSize: 15 }} />}
              onClick={onNewThread}
            />
          </Tooltip>
        )}

        {/* 历史记录按钮 */}
        {hasHistory &&
          (isPanelMode ? (
            <Tooltip title={t('chatAssistant.conversationHistory')} mouseEnterDelay={0.4}>
              <Button
                className="header-action-btn"
                size="middle"
                icon={<UnorderedListOutlined style={{ fontSize: 15 }} />}
                onClick={onOpenHistoryDrawer}
              />
            </Tooltip>
          ) : (
            <HistoryDropdown
              threads={threads}
              loading={loadingThreads}
              activeKey={activeKey}
              onSelect={onActiveThreadChange}
              onNewThread={onNewThread}
            />
          ))}

        {/* 分隔符 */}
        {showMinimizeAction && (
          <span style={{ width: 1, height: 16, background: '#e2e8f0', margin: '0 2px' }} />
        )}

        {/* 最小化按钮 */}
        {showMinimizeAction && (
          <Tooltip title={t('chatAssistant.minimize')} mouseEnterDelay={0.4}>
            <Button
              className="header-action-btn"
              size="middle"
              type="text"
              icon={<CloseOutlined style={{ fontSize: 14 }} />}
              onClick={onMinimize}
            />
          </Tooltip>
        )}
      </Space>
    </div>
  );
}

export default ChatHeader;
