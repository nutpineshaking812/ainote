import React, { useMemo } from 'react';
import { Button, Space, theme } from 'antd';
import { ThunderboltFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import DefaultSender from './DefaultSender.jsx';

export function ChatFooter({
  quickTools = [],
  onQuickToolClick,
  streamLoading = false,
  abort,
  onSend,
  senderPlaceholder,
  appId,
  initialReferences = [],
  renderSender,
}) {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  const quickToolItems = useMemo(() => {
    if (!Array.isArray(quickTools)) return [];
    return quickTools.filter(Boolean);
  }, [quickTools]);

  const senderNode = useMemo(() => {
    if (renderSender) {
      return renderSender({
        onSend,
        disabled: false,
        loading: streamLoading,
        onCancel: abort,
      });
    }
    return (
      <DefaultSender
        disabled={false}
        loading={streamLoading}
        onCancel={abort}
        onSubmit={onSend}
        placeholder={senderPlaceholder || t('chatAssistant.senderPlaceholder')}
        appId={appId}
        initialReferences={initialReferences}
      />
    );
  }, [renderSender, streamLoading, abort, onSend, senderPlaceholder, appId, initialReferences, t]);

  return (
    <div
      className="chat-assistant-sender"
      style={{
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        background: '#ffffff',
        flexShrink: 0,
      }}
    >
      {/* 快捷工具 Chip 行 */}
      {quickToolItems.length > 0 && (
        <div
          style={{
            padding: '10px 14px 0',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {quickToolItems.map((tool, idx) => (
            <Button
              key={tool.key || idx}
              size="small"
              onClick={() => {
                if (!tool?.payload) return;
                if (onQuickToolClick) {
                  onQuickToolClick(tool.payload, tool.data);
                } else {
                  onSend?.(tool.payload, tool.data);
                }
              }}
              style={{
                borderRadius: 20,
                fontSize: 12,
                height: 28,
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'rgba(99, 102, 241, 0.06)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                color: '#6366f1',
                fontWeight: 500,
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
            >
              {tool.title}
            </Button>
          ))}
        </div>
      )}

      {/* 输入框面板 */}
      <div style={{ padding: '0px 0 0' }}>
        {senderNode}
      </div>
    </div>
  );
}

export default ChatFooter;
