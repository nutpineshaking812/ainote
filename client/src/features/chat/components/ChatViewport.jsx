import React from 'react';
import { Prompts } from '@ant-design/x';
import { useTranslation } from 'react-i18next';
import { Avatar, Typography, Space, theme } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import ChatMessageList from './MessageList.jsx';

const { Text, Title } = Typography;

export function ChatViewport({
  messages = [],
  streamLoading = false,
  onAddChart,
  title,
  welcome,
  prompts = [],
  onPromptClick,
  renderAboveMessages,
  assistantAvatar, // 自定义助理头像
  assistantName, // 助理名称，用于 fallback 首字母头像
  displayMode,
}) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const hasMessages = messages.length > 0;

  const promptItems = React.useMemo(() => {
    if (!Array.isArray(prompts)) return [];
    return prompts.filter(Boolean);
  }, [prompts]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
        background: token.colorBgLayout,
        overflow: 'hidden',
      }}
    >
      {/* 消息上方的自定义节点（如状态指示条等） */}
      {typeof renderAboveMessages === 'function' && (
        <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}`, flexShrink: 0 }}>
          {renderAboveMessages(messages)}
        </div>
      )}

      {/* 滚动消息区 */}
      <div
        className="ai-message-scroll"
        assistant="true"
        style={{
          flexGrow: 1,
          height: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {hasMessages ? (
          <ChatMessageList
            messages={messages}
            loading={streamLoading}
            withAvatar={true}
            onAddChart={onAddChart}
            assistantAvatar={assistantAvatar}
            assistantName={assistantName}
            displayMode={displayMode}
          />
        ) : (
          /* 空状态：欢迎屏 */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 20px',
              textAlign: 'center',
            }}
          >
            {/* 动态头像区 */}
            <div
              style={{
                position: 'relative',
                marginBottom: 20,
                display: 'inline-block',
              }}
            >
              {typeof assistantAvatar === 'string' && assistantAvatar ? (
                <Avatar
                  src={assistantAvatar}
                  size={64}
                  style={{
                    border: '3px solid #fff',
                    boxShadow: '0 4px 24px rgba(99, 102, 241, 0.2)',
                    background: '#f1f5f9',
                  }}
                />
              ) : assistantAvatar ? (
                assistantAvatar
              ) : (
                <Avatar
                  size={64}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    boxShadow: '0 4px 24px rgba(99, 102, 241, 0.3)',
                    fontSize: 28,
                    fontWeight: 600,
                  }}
                >
                  {assistantName?.charAt(0)?.toUpperCase() || 'AI'}
                </Avatar>
              )}
              {/* 绿色 Online 状态点 */}
              <span
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#22c55e',
                  border: '2px solid #fff',
                  boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.3)',
                }}
              />
            </div>

            {/* 欢迎标题 */}
            <Title
              level={4}
              style={{
                margin: '0 0 8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: 700,
              }}
            >
              👋 {title || t('aiChat.title')}
            </Title>

            {/* 欢迎描述 */}
            {welcome && (
              <Text
                type="secondary"
                style={{
                  fontSize: 13,
                  lineHeight: 1.7,
                  maxWidth: 340,
                  color: '#64748b',
                  display: 'block',
                  marginBottom: promptItems.length ? 24 : 0,
                }}
              >
                {welcome}
              </Text>
            )}

            {/* 快速提示词列表 */}
            {promptItems.length > 0 && (
              <div style={{ width: '100%', maxWidth: 380, textAlign: 'left' }}>
                <Space align="center" style={{ marginBottom: 12 }}>
                  <ThunderboltOutlined style={{ color: '#6366f1', fontSize: 13 }} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#475569',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('chatAssistant.promptsTitle')}
                  </Text>
                </Space>
                <Prompts
                  vertical
                  items={promptItems}
                  styles={{
                    item: {
                      background: '#ffffff',
                      borderRadius: 10,
                      border: `1px solid ${token.colorBorderSecondary}`,
                      transition: 'all 0.2s ease',
                      marginBottom: 8,
                      cursor: 'pointer',
                      padding: '10px 14px',
                    },
                    title: {
                      fontSize: 13,
                      color: '#334155',
                      fontWeight: 500,
                    },
                  }}
                  onItemClick={(info) => {
                    const data = info.data || {};
                    const payload = data?.payload;
                    if (!payload) return;
                    onPromptClick?.(payload, data.data || {});
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatViewport;
