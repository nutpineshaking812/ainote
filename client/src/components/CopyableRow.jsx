import React from 'react';
import { Space, Typography, Button, message } from 'antd';

/**
 * Generic row with label + value + copy button.
 * Props:
 *  - label: string label displayed at left
 *  - value: string (may be undefined/null)
 *  - emptyText: optional text when value absent
 */
const CopyableRow = ({ label, value, emptyText = '暂无数据' }) => {
  const display = value || emptyText;
  const copy = () => {
    if (!value) return message.warning('没有可复制的内容');
    navigator.clipboard.writeText(value).then(() => message.success('已复制'));
  };
  return (
    <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ color: '#555' }}>{label}</span>
      <Space>
        <Typography.Text type="secondary" style={{ maxWidth: 420 }} ellipsis>
          {display}
        </Typography.Text>
        <Button size="small" onClick={copy}>
          复制
        </Button>
      </Space>
    </Space>
  );
};

export default CopyableRow;
