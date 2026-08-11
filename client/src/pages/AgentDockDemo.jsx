import React, { useState } from 'react';
import { Card, Button, Input, Space, Typography, Badge, Avatar, Divider, Switch, Tooltip } from 'antd';
import {
  RobotOutlined,
  BookOutlined,
  SaveOutlined,
  TranslationOutlined,
  SecurityScanOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { AgentDockProvider } from '../features/chat/context/AgentDockContext';
import { AgentDock } from '../features/chat/components/AgentDock';
import { AgentWorkspace } from '../features/chat/components/AgentWorkspace';
import { EMPLOYEE_SCENARIOS } from '../constants/employee';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

export default function AgentDockDemo() {
  const [docTitle, setDocTitle] = useState('✨ 2026款旗舰智能跑鞋发布手册');
  const [docContent, setDocContent] = useState(
    `# 2026款旗舰智能跑鞋 - 产品发布手册\n\n## 产品概述\n本款跑鞋首次采用全掌超临界发泡中底技术，结合自适应碳纤维板，专为半马和全马竞速跑者打造。内嵌 AI 步态追踪传感器芯片，实时捕捉跑步动态。\n\n## 核心卖点\n1. **极速回弹：** 超临界发泡科技提供高达 85% 的能量反馈，显著降低肌肉疲劳。\n2. **精准步态分析：** 传感器通过低功耗蓝牙自动与手机 App 同步，分析触地时间与足内翻幅度。\n3. **透气与耐磨：** 采用一体编织飞织鞋面，大底为马牌耐磨橡胶，抓地力增强 25%。\n\n## 目标市场\n核心跑者、科技运动爱好者、马拉松发烧友。零售价：1299 元人民币。`
  );
  
  const [assistantMinimized, setAssistantMinimized] = useState(false);
  const [displayMode, setDisplayMode] = useState('panel');

  // 将当前文档内容作为初始上下文引用提供给 AI
  const initialReferences = [
    {
      key: 'demo-doc-ref',
      label: `当前正文: ${docTitle}`,
      removable: false,
      type: 'document',
      value: 'doc-demo-id',
    },
  ];

  return (
    <AgentDockProvider
      appId="demo" // demo 模式：API 返回空列表时 Dock 为空，可通过 + 按钮手动添加
      targetId="doc-demo-id"
      scenario={EMPLOYEE_SCENARIOS.DOCUMENT}
    >
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#f4f5f8',
          overflow: 'hidden',
          fontFamily: "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        {/* 顶部高级协作 Header 栏 */}
        <header
          style={{
            height: '60px',
            background: '#ffffff',
            borderBottom: '1px solid #eef0f4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            zIndex: 10,
          }}
        >
          <Space align="center" size={12}>
            <BookOutlined style={{ fontSize: '20px', color: '#6366f1' }} />
            <div>
              <Text style={{ fontWeight: 800, fontSize: 16, color: '#1e293b' }}>
                协同编辑工作台
              </Text>
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 12, borderLeft: '1px solid #ddd', paddingLeft: 12 }}>
                多数字员工智能协同模式 (Agent-Dock Demo)
              </Text>
            </div>
          </Space>

          {/* 模拟顶部的多特工会议室/协同圈 */}
          <Space size={16} align="center">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0f3ff', padding: '4px 12px', borderRadius: 16 }}>
              <UsergroupAddOutlined style={{ color: '#6366f1' }} />
              <Text style={{ fontSize: 11, fontWeight: 600, color: '#4f46e5' }}>AI 智囊团已加入协同</Text>
            </div>
            <Avatar.Group size="small" maxCount={3}>
              <Tooltip title="丽丽 - 公关文案大师">
                <Avatar src="https://api.dicebear.com/7.x/adventurer/svg?seed=Lily&backgroundColor=b6e3f4" />
              </Tooltip>
              <Tooltip title="乔治 - 多语种翻译官">
                <Avatar src="https://api.dicebear.com/7.x/adventurer/svg?seed=George&backgroundColor=c0aede" />
              </Tooltip>
              <Tooltip title="老王 - 法务风控顾问">
                <Avatar src="https://api.dicebear.com/7.x/adventurer/svg?seed=Wang&backgroundColor=ffd5dc" />
              </Tooltip>
            </Avatar.Group>
            <Divider type="vertical" />
            <Button type="primary" size="small" icon={<SaveOutlined />} style={{ borderRadius: 6 }}>
              保存文档
            </Button>
          </Space>
        </header>

        {/* 核心双栏布局 */}
        <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
          
          {/* 左侧：精美模拟编辑器面板 */}
          <div
            style={{
              flex: 1,
              padding: '24px 40px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: '#f8fafc',
              position: 'relative',
              transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            }}
          >
            <Card
              bordered={false}
              style={{
                maxWidth: '850px',
                width: '100%',
                minHeight: 'calc(100vh - 160px)',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.01)',
                padding: '24px 16px',
                background: '#ffffff',
              }}
            >
              {/* 文档标题区 */}
              <Input
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                bordered={false}
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: '#1e293b',
                  marginBottom: '20px',
                  padding: '4px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              />
              
              {/* 编辑正文区 */}
              <TextArea
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                bordered={false}
                autoSize={{ minRows: 15 }}
                style={{
                  fontSize: '14px',
                  lineHeight: '1.8',
                  color: '#334155',
                  padding: 0,
                  resize: 'none',
                }}
              />
            </Card>

            {/* 贴边悬浮的极简 Dock 工具栏 */}
            <AgentDock placement="right" onSelect={() => setAssistantMinimized(false)} />

          </div>

          {/* 右侧：AI 数字员工对话座舱（带流式过渡收起效果） */}
          <div
            style={{
              width: assistantMinimized ? '0px' : '450px',
              height: '100%',
              background: '#ffffff',
              borderLeft: '1px solid #eef0f4',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
              position: 'relative',
              zIndex: 9,
            }}
          >
            <div style={{ width: '450px', height: '100%' }}>
              <AgentWorkspace
                appId="demo"
                minimized={assistantMinimized}
                onMinimizedChange={setAssistantMinimized}
                defaultDisplayMode={displayMode}
                onDisplayModeChange={setDisplayMode}
                initialReferences={initialReferences}
              />
            </div>
          </div>

          {/* 折叠/呼唤 AI 侧边栏的浮动小把手 */}
          {assistantMinimized && (
            <div
              onClick={() => setAssistantMinimized(false)}
              style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '56px',
                background: '#6366f1',
                borderRadius: '8px 0 0 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '-2px 0 8px rgba(99,102,241,0.3)',
                zIndex: 10,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#4f46e5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#6366f1')}
            >
              <DoubleLeftOutlined style={{ color: '#fff', fontSize: '9px' }} />
            </div>
          )}
        </div>
      </div>
    </AgentDockProvider>
  );
}
