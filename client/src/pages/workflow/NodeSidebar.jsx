import React from 'react';
import { Card, Space, Typography, Tooltip, Collapse, theme, Tag } from 'antd';
import { BarsOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useWorkflow } from './context/WorkflowContext';
import { getPluginIcon } from './utils/pluginIcons';

const { Text } = Typography;
const { Panel } = Collapse;

const NodeSidebar = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { categories, loading, fullRegistry } = useWorkflow();

  const onDragStart = (event, node) => {
    // 兼容原有的拖拽数据格式
    const nodeType =
      node.type === 'trigger' ? 'plugin-trigger' : node.pluginId ? 'plugin-action' : node.type;

    event.dataTransfer.setData('application/reactflow', nodeType);
    if (node.pluginId) {
      event.dataTransfer.setData('application/plugin-id', node.pluginId);
    }
    if (node.initialData) {
      event.dataTransfer.setData('application/initial-data', JSON.stringify(node.initialData));
    }

    event.dataTransfer.effectAllowed = 'move';

    // 拖拽幽灵图逻辑 (保留原始逻辑)
    const isAddonNode = node.isAddon || fullRegistry[nodeType]?.category === 'addon';
    if (isAddonNode) {
      let primaryColor = '#722ed1';
      if (nodeType === 'fetchMemory') primaryColor = '#52c41a';
      if (nodeType === 'loadMemory') primaryColor = '#722ed1';
      if (nodeType === 'recallKnowledge') primaryColor = '#fa8c16';

      const ghost = document.createElement('div');
      ghost.style.width = '56px';
      ghost.style.height = '56px';
      ghost.style.borderRadius = '16px';
      ghost.style.background = '#fff';
      ghost.style.border = `2.5px solid ${primaryColor}`;
      ghost.style.display = 'flex';
      ghost.style.alignItems = 'center';
      ghost.style.justifyContent = 'center';
      ghost.style.position = 'absolute';
      ghost.style.top = '-1000px';

      const originalIcon = event.currentTarget.querySelector('.anticon');
      if (originalIcon) {
        const iconClone = originalIcon.cloneNode(true);
        iconClone.style.fontSize = '24px';
        iconClone.style.color = primaryColor;
        const svg = iconClone.querySelector('svg');
        if (svg) {
          svg.style.width = '24px';
          svg.style.height = '24px';
          svg.style.fill = primaryColor;
        }
        ghost.appendChild(iconClone);
      }

      document.body.appendChild(ghost);
      event.dataTransfer.setDragImage(ghost, 28, 28);
      setTimeout(() => {
        if (document.body.contains(ghost)) {
          document.body.removeChild(ghost);
        }
      }, 0);
    }
  };

  if (loading) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 20,
        top: 20,
        width: 250,
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      <Card
        size="small"
        title={
          <Space>
            <BarsOutlined />
            <Text strong>{t('workflow.designer.nodes')}</Text>
          </Space>
        }
        style={{
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          borderRadius: 12,
          border: 'none',
          maxHeight: 'calc(100vh - 100px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        bodyStyle={{ padding: 0, overflowY: 'auto' }}
      >
        <Collapse
          accordion
          ghost
          expandIconPosition="end"
          style={{ padding: '0 4px' }}
          styles={{ body: { padding: 0 } }}
        >
          {categories
            .filter((cat) => cat.nodes.length > 0)
            .map((cat) => (
              <Panel
                header={
                  <Text
                    type="secondary"
                    style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}
                  >
                    {cat.name}
                  </Text>
                }
                key={cat.key}
              >
                <div style={{ paddingBottom: 12 }}>
                  <Space direction="vertical" style={{ width: '100%' }} size={4}>
                    {cat.nodes.map((node) => (
                      <div
                        key={node.pluginId ? `${node.type}-${node.pluginId}` : node.id || node.type}
                        onDragStart={(event) => onDragStart(event, node)}
                        draggable
                        style={{
                          padding: '10px',
                          borderRadius: 8,
                          cursor: 'grab',
                          background: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          transition: 'all 0.2s',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        className="workflow-node-item"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = token.colorPrimary;
                          e.currentTarget.style.background = token.colorPrimaryBg;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#f0f0f0';
                          e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <div style={{ fontSize: 18, display: 'flex' }}>
                          {node.isPlugin
                            ? getPluginIcon(node.icon, { fontSize: 18, color: node.iconColor })
                            : node.icon}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Text strong style={{ fontSize: 12 }} ellipsis>
                              {node.label || node.name}
                            </Text>
                            {node.isPlugin && (
                              <Tag
                                size="small"
                                bordered={false}
                                style={{
                                  fontSize: 9,
                                  padding: '0 4px',
                                  height: 16,
                                  display: 'flex',
                                  alignItems: 'center',
                                  background: node.isAddon ? '#f9f0ff' : '#e6f7ff',
                                  color: node.isAddon ? '#722ed1' : '#1890ff',
                                }}
                              >
                                {node.isAddon ? 'Plugin | Addon' : 'Plugin'}
                              </Tag>
                            )}
                          </div>
                          <Text type="secondary" style={{ fontSize: 10 }} ellipsis>
                            {node.desc || node.description}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </Space>
                </div>
              </Panel>
            ))}
        </Collapse>
      </Card>
    </div>
  );
};

export default NodeSidebar;
