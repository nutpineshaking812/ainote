/**
 * PlayroomWorkspaceSidebarLeft.jsx
 * Unified Glassmorphic Workspace card on the left sidebar:
 * 1. Milestone steps with progressive green-to-yellow highlighted indicators.
 * 2. Collaborative task Kanban board with status Tag nodes.
 */

import React from 'react';
import { Card, Tabs, Tag, List, Empty, Typography } from 'antd';

const { Text } = Typography;

export function PlayroomWorkspaceSidebarLeft({
  activeSteps,
  activeIndex,
  tasks,
}) {
  return (
    <div className="playroom-sidebar-left" style={{ height: '100%' }}>
      <Card
        className="playroom-card panel-glass workspace-card"
        bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
        style={{ height: '100%' }}
      >
        <Tabs
          defaultActiveKey="1"
          centered
          size="middle"
          className="workspace-tabs"
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          items={[
            {
              key: '1',
              label: (
                <span style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🏁 里程碑步骤
                </span>
              ),
              children: (
                <div style={{ padding: '12px 16px', overflowY: 'auto', flex: 1, height: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeSteps.map((step, idx) => {
                      const isFinished = idx < activeIndex;
                      const isCurrent = idx === activeIndex;

                      let dotColor = '#cbd5e1';
                      let textColor = '#64748b';
                      let icon = '○';
                      let bgStyle = 'transparent';
                      let borderStyle = '1px solid #e2e8f0';

                      if (isFinished) {
                        dotColor = '#10b981';
                        textColor = '#94a3b8';
                        icon = '✓';
                      } else if (isCurrent) {
                        dotColor = '#d97706';
                        textColor = '#1e293b';
                        icon = '⚡';
                        bgStyle = '#fffbeb';
                        borderStyle = '1px solid #ffe58f';
                      }

                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: bgStyle,
                            border: isCurrent ? borderStyle : '1px solid transparent',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                color: isCurrent ? '#fff' : dotColor,
                                fontWeight: 'bold',
                                fontSize: '9px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                border: isFinished || isCurrent ? `1px solid ${dotColor}` : '1px solid #cbd5e1',
                                background: isFinished ? '#ecfdf5' : isCurrent ? '#d97706' : 'transparent',
                                flexShrink: 0,
                              }}
                            >
                              {icon}
                            </span>
                            <Text
                              style={{
                                fontSize: '12px',
                                color: isCurrent ? '#1e293b' : textColor,
                                fontWeight: isCurrent ? 700 : 'normal',
                                textDecoration: isFinished ? 'line-through' : 'none',
                              }}
                              ellipsis={{ tooltip: step.title }}
                            >
                              {step.title}
                            </Text>
                          </div>
                          {isCurrent && (
                            <Tag color="warning" className="pulse-tag" style={{ margin: 0, fontSize: '9px', padding: '0 4px' }}>
                              进行中
                            </Tag>
                          )}
                          {isFinished && (
                            <span style={{ fontSize: '10px', color: '#10b981' }}>已通过</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ),
            },
            {
              key: '2',
              label: (
                <span style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  📁 协同任务树
                </span>
              ),
              children: (
                <div className="kanban-scroll-area" style={{ padding: '12px 16px', overflowY: 'auto', flex: 1, height: '100%' }}>
                  {tasks.length > 0 ? (
                    <List
                      dataSource={tasks}
                      renderItem={(item) => {
                        let statusTag = <Tag color="default">待执行</Tag>;
                        let cardClass = 'kanban-item todo';
                        if (item.state === 'progress') {
                          statusTag = (
                            <Tag color="processing" className="pulse-tag">
                              协同中 ⚡
                            </Tag>
                          );
                          cardClass = 'kanban-item progress';
                        } else if (item.state === 'done') {
                          statusTag = <Tag color="success">已完成</Tag>;
                          cardClass = 'kanban-item done';
                        }

                        return (
                          <div className={cardClass} style={{ marginBottom: 10 }}>
                            <div className="kanban-title" style={{ fontSize: '12px', fontWeight: 600 }}>{item.title}</div>
                            <div className="kanban-meta" style={{ marginTop: '6px' }}>{statusTag}</div>
                          </div>
                        );
                      }}
                    />
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <span style={{ color: '#888', fontSize: '12px' }}>暂无子任务 Kanban 树</span>
                      }
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
