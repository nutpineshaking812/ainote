import React from 'react';
import { Space, Typography } from 'antd';

export default function DocumentStatusBar({
  wordCount,
  charCount,
  readingTime,
  autoSaveEnabled,
  dirty,
  content,
  lastSavedAt,
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderTop: '1px solid #f0f0f0',
        marginTop: 'auto',
      }}
    >
      <Space size={16} split={<span style={{ color: '#d9d9d9' }}>·</span>}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 500 }}>{wordCount}</span> 字
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 500 }}>{charCount}</span> 字符
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          预计阅读 <span style={{ fontWeight: 500 }}>{readingTime}</span>
        </Typography.Text>
      </Space>

      <Space size={8}>
        {autoSaveEnabled && dirty && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#52c41a',
                marginRight: 6,
              }}
            />
            自动保存中...
          </Typography.Text>
        )}
        {!dirty && content && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#52c41a',
                marginRight: 6,
              }}
            />
            已保存
          </Typography.Text>
        )}
        {lastSavedAt && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            最后保存：{lastSavedAt.toLocaleString()}
          </Typography.Text>
        )}
      </Space>
    </div>
  );
}
