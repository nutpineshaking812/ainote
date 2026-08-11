import React from 'react';
import { Space, Input, Button, Tooltip, Modal } from 'antd';
import { Typography } from 'antd';

const { Text } = Typography;

/**
 * LinkActionsBar
 * 展示公开链接与右侧操作按钮：复制 / 打开 / 二维码。
 * 复制逻辑由父组件传入（可智能复制授权码）。
 */
const LinkActionsBar = ({ link, useAccessCode, accessCode, onCopy }) => {
  return (
    <Space style={{ width: '100%' }} align="center">
      <Input value={link} readOnly style={{ flex: 1, minWidth: 600 }} />
      <Tooltip title={useAccessCode && accessCode ? '复制链接与授权码' : '复制链接'}>
        <Button type="primary" onClick={onCopy}>
          复制
        </Button>
      </Tooltip>
      <Button onClick={() => window.open(link, '_blank')}>打开</Button>
      <Button
        onClick={() =>
          Modal.info({
            title: '二维码',
            content: <div style={{ wordBreak: 'break-all' }}>{link}</div>,
          })
        }
      >
        二维码
      </Button>
    </Space>
  );
};

export default LinkActionsBar;
