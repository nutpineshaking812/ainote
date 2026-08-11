import React from 'react';
import { Space, Button, Tooltip, Popover } from 'antd';
import {
  FullscreenOutlined,
  FullscreenExitOutlined,
  SaveOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

export default function DocumentHeaderActions({
  fullscreen,
  onToggleFullscreen,
  saving,
  onSave,
  helpContent,
}) {
  return (
    <Space size="small">
      <Tooltip title={fullscreen ? '退出全屏' : '全屏编辑'}>
        <Button
          size="small"
          icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          onClick={onToggleFullscreen}
        />
      </Tooltip>
      <Popover content={helpContent} title={null} trigger="click" placement="bottomRight">
        <Button size="small" icon={<QuestionCircleOutlined />}>
          帮助
        </Button>
      </Popover>
      <Tooltip title="快捷键 Cmd/Ctrl+S">
        <Button
          size="small"
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={onSave}
        >
          保存
        </Button>
      </Tooltip>
    </Space>
  );
}
