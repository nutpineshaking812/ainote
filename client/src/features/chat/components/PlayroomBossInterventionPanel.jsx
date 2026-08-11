/**
 * PlayroomBossInterventionPanel.jsx
 * Boss real-time override intervention textbox panel.
 */

import React from 'react';
import { Input, Button, Typography } from 'antd';
import { CustomerServiceOutlined, SendOutlined } from '@ant-design/icons';

const { Text } = Typography;

export function PlayroomBossInterventionPanel({
  bossInput,
  setBossInput,
  handleBossSend,
  isRunningSOP,
}) {
  return (
    <div className="boss-command-console panel-glass">
      <div className="boss-title-bar">
        <CustomerServiceOutlined style={{ color: '#ffd600', marginRight: 6 }} />
        <Text style={{ color: '#ffd600', fontWeight: 'bold', fontSize: 12 }}>
          老板指令插言面板 (BOSS Real-time Override)
        </Text>
      </div>
      <div className="boss-input-row">
        <Input
          placeholder="在此向执行中的项目组输入您的批示（如：“在图书主表里增加图书分类字段”、“换个更幽默的文案”），Agent小人会立刻做出反应！"
          value={bossInput}
          onChange={(e) => setBossInput(e.target.value)}
          onPressEnter={handleBossSend}
          disabled={!isRunningSOP}
          className="boss-text-input"
        />
        <Button type="primary" icon={<SendOutlined />} onClick={handleBossSend} disabled={!isRunningSOP} className="boss-send-btn">
          下达老板指示
        </Button>
      </div>
    </div>
  );
}
