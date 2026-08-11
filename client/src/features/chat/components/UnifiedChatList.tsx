import React, { useCallback, useMemo, useState } from 'react';
import { Bubble } from '@ant-design/x';
import {
  UserOutlined,
  LoadingOutlined,
  DownOutlined,
  UpOutlined,
  CopyOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { Avatar, Typography, Space, theme } from 'antd';
import { SegmentUIMapping } from '../utils/messageTransformer';

const { Text } = Typography;

const extractMessageText = (m: UnifiedMessage): string => {
  return m.parts
    .map((part) => {
      if (part._type === 'text' || part.type === 'text') {
        return String(part.content ?? part.text ?? '');
      }
      if (part._type === 'chart_data') {
        const chartData = part.data ?? part.content;
        return chartData ? `[图表数据] ${JSON.stringify(chartData).slice(0, 200)}` : '';
      }
      // thoughts / tool_call 等思考过程不复制
      return '';
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();
};

export interface MessagePart {
  type: string;
  status?: 'loading' | 'success' | 'error';
  key: string;
  _type: string;
  [key: string]: any;
}

export interface UnifiedMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  status?: 'loading' | 'success' | 'error';
  createdAt?: string | number;
  avatar?: React.ReactNode;
}

interface UnifiedChatListProps {
  messages: UnifiedMessage[];
  loading?: boolean;
  onAddChart?: (message: any, segment: any) => void;
  assistantAvatar?: string | React.ReactNode; // 新增：支持自定义助理头像
  assistantName?: string; // 助理名称，用于 fallback 首字母头像
  displayMode?: string;
}

const ThoughtGroup: React.FC<{
  items: MessagePart[];
  loading: boolean;
  isFinished: boolean;
}> = React.memo(({ items, loading, isFinished }) => {
  const { token } = theme.useToken();
  const [expanded, setExpanded] = useState(!isFinished);

  React.useEffect(() => {
    setExpanded(!isFinished);
  }, [isFinished]);

  const label = !loading ? `已完成 ${items.length} 步推理` : '逻辑分析中...';

  return (
    <div style={{ margin: '4px 0' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'inline-block', marginBottom: expanded ? 8 : 0 }}
      >
        <Space
          style={{
            background: token.colorFillQuaternary,
            padding: '2px 8px',
            borderRadius: 14,
            border: `1px solid ${token.colorBorderSecondary}`,
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.2s',
          }}
        >
          {loading && <LoadingOutlined spin style={{ fontSize: 10 }} />}
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>
            {label}
          </Text>
          {expanded ? (
            <UpOutlined style={{ fontSize: 10, color: token.colorTextDescription }} />
          ) : (
            <DownOutlined style={{ fontSize: 10, color: token.colorTextDescription }} />
          )}
        </Space>
      </div>

      {expanded && (
        <div style={{ padding: '0 0 8px 4px' }}>
          {items.map((part) => {
            const config = (SegmentUIMapping as any)[part._type] || (SegmentUIMapping as any).text;
            return config.render(part, part.key, { status: part.status });
          })}
        </div>
      )}
    </div>
  );
});

const ChatItem = React.memo<{
  m: UnifiedMessage;
  onAddChart?: any;
  displayMode?: string;
}>(({ m, onAddChart, displayMode }) => {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = extractMessageText(m);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [m]);

  return (
    <div
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setCopied(false); }}
    >
      {m.parts.map((part, index) => {
        if (part.type === 'thoughts' && part.items && part.items.length > 0) {
          return (
            <ThoughtGroup
              key={part.key || index}
              items={part.items}
              loading={part.status === 'loading'}
              isFinished={m.status === 'success' || m.status === 'error'}
            />
          );
        }

        const config = (SegmentUIMapping as any)[part._type || part.type] || (SegmentUIMapping as any).text;
        return config.render(part, part.key || `${m.id}-p-${index}`, {
          status: part.status || m.status,
          onAddChart,
          message: m,
          displayMode,
        });
      })}
      {hovered && m.role !== 'user' && m.status !== 'loading' && (
        <div
          onClick={handleCopy}
          title="复制"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.05)',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'background 0.15s',
            zIndex: 2,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              m.role === 'user' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              m.role === 'user' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)';
          }}
        >
          {copied ? (
            <CheckOutlined style={{ fontSize: 13, color: '#52c41a' }} />
          ) : (
            <CopyOutlined style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)' }} />
          )}
        </div>
      )}
    </div>
  );
});

export const UnifiedChatList: React.FC<UnifiedChatListProps> = ({
  messages,
  onAddChart,
  assistantAvatar,
  assistantName,
  displayMode,
}) => {
  const { token } = theme.useToken();

  const bubbleItems = useMemo(() => {
    return messages.map((m) => {
      const isAssistant = m.role === 'assistant';
      
      // 解析动态头像
      let resolvedAvatar = m.avatar;
      if (!resolvedAvatar) {
        if (isAssistant) {
          if (typeof assistantAvatar === 'string' && assistantAvatar) {
            resolvedAvatar = (
              <Avatar
                src={assistantAvatar}
                size={34}
                style={{
                  border: '1.5px solid #fff',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.15)',
                  background: '#f1f5f9',
                }}
              />
            );
          } else if (assistantAvatar) {
            resolvedAvatar = assistantAvatar;
          } else {
            resolvedAvatar = (
              <Avatar
                size={34}
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.15)',
                  fontWeight: 600,
                }}
              >
                {assistantName?.charAt(0)?.toUpperCase() || 'AI'}
              </Avatar>
            );
          }
        } else {
          resolvedAvatar = (
            <Avatar
              icon={<UserOutlined />}
              size={34}
              style={{
                background: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
                boxShadow: '0 2px 8px rgba(30, 41, 59, 0.15)',
              }}
            />
          );
        }
      }

      return {
        key: m.id,
        role: m.role,
        placement: (isAssistant ? 'start' : 'end') as 'start' | 'end',
        content: <ChatItem m={m} onAddChart={onAddChart} displayMode={displayMode} />,
        avatar: resolvedAvatar,
        styles: {
          content: {
            borderRadius: isAssistant ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
            background: isAssistant ? token.colorBgContainer : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            border: isAssistant ? `1px solid ${token.colorBorderSecondary}` : 'none',
            boxShadow: isAssistant ? '0 4px 16px rgba(15, 23, 42, 0.04)' : '0 4px 12px rgba(99, 102, 241, 0.15)',
            color: isAssistant ? 'rgba(0, 0, 0, 0.88)' : '#ffffff',
            padding: '10px 14px',
            maxWidth: '100%',
            fontSize: '14px',
            lineHeight: 1.6,
          },
        },
      };
    });
  }, [messages, token, onAddChart, assistantAvatar, assistantName, displayMode]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: token.colorBgLayout,
      }}
    >
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .ai-seg-text { font-size: 14px; line-height: 1.6; color: rgba(0, 0, 0, 0.88); }
        /* 用户气泡内部文本强制白色 */
        .ant-bubble-end .ai-seg-text {
          color: #ffffff !important;
        }
        /* 用户气泡内的 Markdown 链接或特定节点配色优化 */
        .ant-bubble-end a {
          color: #e0e7ff !important;
          text-decoration: underline;
        }
      `}</style>
      <Bubble.List
        items={bubbleItems}
        autoScroll
        style={{ flex: 1, padding: '12px', overflowY: 'auto' }}
      />
    </div>
  );
};

export default UnifiedChatList;
