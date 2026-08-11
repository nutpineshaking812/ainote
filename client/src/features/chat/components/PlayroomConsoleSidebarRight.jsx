/**
 * PlayroomConsoleSidebarRight.jsx
 * Unified Glassmorphic Console card on the right sidebar:
 * 1. Printed artifacts deck list.
 * 2. Live terminal meetings stream channel with smooth bottom scrolling anchor.
 */

import React from 'react';
import { Card, Tabs, Tag, Empty, Typography } from 'antd';
import { DatabaseOutlined, FileTextOutlined } from '@ant-design/icons';

export function PlayroomConsoleSidebarRight({
  artifacts,
  chatHistory,
  chatEndRef,
}) {
  return (
    <div className="playroom-sidebar-right" style={{ height: '100%' }}>
      <Card
        className="playroom-card panel-glass console-card"
        bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
        style={{ height: '100%' }}
      >
        <Tabs
          defaultActiveKey="1"
          centered
          size="middle"
          className="console-tabs"
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          items={[
            {
              key: '1',
              label: (
                <span style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  📠 输出成果
                </span>
              ),
              children: (
                <div className="artifacts-scroll-area" style={{ padding: '12px 16px', overflowY: 'auto', flex: 1, height: '100%' }}>
                  {artifacts.length > 0 ? (
                    artifacts.map((art) => (
                      <div key={art.id} className="artifact-printed-card" style={{ marginBottom: 12 }}>
                        <div className="art-card-header">
                          <div className="art-card-title">
                            {art.type === 'table' ? (
                              <DatabaseOutlined className="art-icon table" />
                            ) : (
                              <FileTextOutlined className="art-icon post" />
                            )}
                            <span style={{ fontSize: '12px', fontWeight: 600 }}>{art.title}</span>
                          </div>
                          <Tag color="cyan" style={{ fontSize: '10px' }}>已落盘</Tag>
                        </div>
                        <div className="art-card-body" style={{ fontSize: '11.5px', marginTop: '6px' }}>{art.content}</div>
                        <div className="art-card-footer" style={{ marginTop: '8px', fontSize: '10px', color: '#94a3b8' }}>
                          <span>创建人: {art.creator}</span>
                          <span>{art.createdAt}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={<span style={{ color: '#888', fontSize: '12px' }}>等待打印机输出项目成果...</span>}
                    />
                  )}
                </div>
              ),
            },
            {
              key: '2',
              label: (
                <span style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  💬 实时信道
                </span>
              ),
              children: (
                <div className="chat-stream-area" style={{ padding: '12px 16px', overflowY: 'auto', flex: 1, height: '100%' }}>
                  {chatHistory.length > 0 ? (
                    chatHistory.map((msg) => {
                      const isBoss = msg.role === 'BOSS';
                      let bubbleClass = isBoss ? 'chat-row-boss' : 'chat-row-agent';

                      return (
                        <div key={msg.id} className={`chat-stream-row ${bubbleClass}`} style={{ marginBottom: 10 }}>
                          <div className="chat-row-header">
                            <span className={`chat-speaker ${isBoss ? 'speaker-boss' : ''}`} style={{ fontSize: '11px', fontWeight: 600 }}>
                              {msg.speaker} {msg.role !== 'BOSS' && `[${msg.role}]`}
                            </span>
                            <span className="chat-time" style={{ fontSize: '10px', color: '#94a3b8' }}>{msg.timestamp}</span>
                          </div>
                          <div className="chat-row-text" style={{ fontSize: '12px', marginTop: '4px' }}>{msg.text}</div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: 'center', color: '#666', marginTop: 24, fontSize: 11 }}>
                      会议发言信道监听中...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
