// 中文注释: ChatWindow 组件 - 展示消息列表与主输入框, 处理澄清输入 UI。
import React, { useState } from 'react';
import { Input, Button, Space, Tag, Typography, Flex } from 'antd';
const { Text } = Typography;

function MessageBubble({ msg }) {
  const colorMap = {
    user: 'blue',
    assistant: 'green',
    status: 'default',
    error: 'red',
  };
  return (
    <div style={{ marginBottom: 8 }}>
      <Tag color={colorMap[msg.role] || 'default'}>{msg.role}</Tag>
      <Text style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Text>
    </div>
  );
}

export default function ChatWindow({
  messages = [],
  loading,
  inputRequest,
  onSend,
  onUserInputSubmit,
}) {
  const [text, setText] = useState('');
  const [clarifyValue, setClarifyValue] = useState('');

  const disabledMain = !!inputRequest; // 有澄清请求则禁用主输入

  const handleSend = () => {
    if (!text.trim()) return;
    onSend?.(text.trim());
    setText('');
  };

  const handleClarifySubmit = () => {
    if (!clarifyValue.trim()) return;
    onUserInputSubmit?.(clarifyValue.trim());
    setClarifyValue('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          background: '#fafafa',
          border: '1px solid #eee',
          borderRadius: 4,
        }}
      >
        {messages.map((m, idx) => (
          <MessageBubble key={idx + m.role} msg={m} />
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        {inputRequest && (
          <div
            style={{ marginBottom: 12, padding: 10, border: '1px dashed #d9d9d9', borderRadius: 4 }}
          >
            <Text strong>需要补充: {inputRequest.field}</Text>
            <div style={{ marginTop: 6 }}>{inputRequest.message}</div>
            {inputRequest.inputType === 'text' && (
              <Space style={{ marginTop: 8 }}>
                <Input
                  placeholder={inputRequest.placeholder || '请输入'}
                  value={clarifyValue}
                  onChange={(e) => setClarifyValue(e.target.value)}
                  style={{ width: 260 }}
                />
                <Button type="primary" onClick={handleClarifySubmit}>
                  提交
                </Button>
              </Space>
            )}
            {inputRequest.inputType === 'confirmation' && (
              <Space style={{ marginTop: 8 }}>
                <Button type="primary" onClick={() => onUserInputSubmit?.('yes')}>
                  是
                </Button>
                <Button onClick={() => onUserInputSubmit?.('no')}>否</Button>
              </Space>
            )}
          </div>
        )}
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder={disabledMain ? '等待补充输入...' : '请输入消息 (支持 @表单)'}
            disabled={disabledMain}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPressEnter={handleSend}
          />
          <Button type="primary" loading={loading} onClick={handleSend}>
            发送
          </Button>
        </Space.Compact>
      </div>
    </div>
  );
}
