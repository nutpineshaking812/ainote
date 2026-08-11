import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Typography, Space, theme, Badge } from 'antd';
import { getPluginIcon } from '../../utils/pluginIcons';
import BaseNodeLayout from './BaseNodeLayout';
import AddonNodeLayout from './AddonNodeLayout';
import { getPluginMetaSync, getPlugins } from '../../../../api/plugins';
import { useWorkflow } from '../../context/WorkflowContext';

const { Text } = Typography;

const PluginNode = (props) => {
  const { data, id, selected, onOpenSettings } = props;
  const { pluginStatuses = {} } = useWorkflow();
  const { token } = theme.useToken();
  const [pluginMeta, setPluginMeta] = React.useState(getPluginMetaSync(data.pluginId));

  React.useEffect(() => {
    if (!pluginMeta && data.pluginId) {
      getPlugins().then(() => {
        setPluginMeta(getPluginMetaSync(data.pluginId));
      });
    }
  }, [data.pluginId, pluginMeta]);

  // 优先使用用户自定义的名称(data.label)，如果没有，则使用配置字典里的名称
  const label = data.label || pluginMeta?.name || 'Plugin Node';
  const isAddon = pluginMeta?.isAddon || data.isAddon;
  const icon = pluginMeta?.icon || data.icon;
  const category = pluginMeta?.category || data.category;
  const desc = pluginMeta?.description || data.desc;

  // 获取实时状态 (优先找节点 ID 匹配的，再找插件全局的)
  const status = pluginStatuses[id] || pluginStatuses[data.pluginId];
  const isConnected = status?.connected === true;
  const isSwitch = data.pluginId === 'switch';
  const cases = data.pluginParams?.cases || [];

  const customHandles = Array.isArray(pluginMeta?.slots) && pluginMeta.slots.length > 0 ? (
    <>
      {pluginMeta.slots.map((slot) => {
        const handlePosition = slot.position === 'top' ? Position.Top 
          : slot.position === 'left' ? Position.Left
          : slot.position === 'right' ? Position.Right
          : Position.Bottom;

        return (
          <React.Fragment key={slot.id}>
            <Handle
              id={slot.id}
              type={slot.type || 'target'}
              position={handlePosition}
              style={{
                bottom: slot.position === 'bottom' ? -6 : undefined,
                top: slot.position === 'top' ? -6 : undefined,
                left: slot.left || '50%',
                transform: 'translateX(-50%)',
                width: 14,
                height: 14,
                background: slot.color || '#1890ff',
                border: '3px solid #fff',
                borderRadius: '3px',
                zIndex: 10,
                boxShadow: selected ? `0 0 8px ${slot.color || '#1890ff'}80` : 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: slot.position === 'bottom' ? -22 : undefined,
                top: slot.position === 'top' ? -22 : undefined,
                left: slot.left || '50%',
                transform: 'translateX(-50%)',
                fontSize: '9px',
                fontWeight: 700,
                color: slot.color || '#1890ff',
                background: slot.background || '#e6f7ff',
                padding: '1px 6px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                border: slot.border || '1px solid #91d5ff',
                pointerEvents: 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              }}
            >
              <span>{slot.label || slot.id}</span>
            </div>
          </React.Fragment>
        );
      })}
    </>
  ) : null;

  if (isAddon) {
    return (
      <AddonNodeLayout
        id={id}
        data={data}
        selected={selected}
        onOpenSettings={onOpenSettings}
        icon={getPluginIcon(icon, { fontSize: 24 })}
        primaryColor={category === 'Memory' ? '#fa8c16' : '#722ed1'}
        title={label}
        subtitle="Plugin | Addon"
      >
        {data.features?.includes('status_tracking') && (
          <div
            style={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 12,
              height: 12,
              background: isConnected ? '#52c41a' : '#bfbfbf',
              borderRadius: '50%',
              border: '2px solid #fff',
            }}
          />
        )}
      </AddonNodeLayout>
    );
  }

  return (
    <BaseNodeLayout
      id={id}
      data={data}
      selected={selected}
      onOpenSettings={onOpenSettings}
      title={label}
      icon={getPluginIcon(icon, { fontSize: 20 })}
      color={category === 'Memory' ? '#faad14' : token.colorPrimary}
      subtitle={desc || data.pluginId}
      hideRightHandle={isSwitch}
      customHandles={customHandles}
    >
      {isSwitch ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {cases.map((c, index) => {
            const handleId = c.handle || `branch_${index + 1}`;
            const caseLabel = c.value || `条件 ${index + 1}`;
            const operatorLabel = c.operator || 'equals';

            return (
              <div
                key={handleId}
                style={{
                  position: 'relative',
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                  borderRadius: 6,
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 32,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 'calc(100% - 10px)', overflow: 'hidden' }}>
                  <Text strong style={{ fontSize: 11, color: '#faad14' }}>
                    {index + 1}
                  </Text>
                  <Text ellipsis style={{ fontSize: 11, color: '#595959', margin: 0 }}>
                    {operatorLabel === 'is_empty' ? '为空' : operatorLabel === 'is_not_empty' ? '不为空' : caseLabel}
                  </Text>
                </div>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={handleId}
                  style={{
                    position: 'absolute',
                    right: -16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 8,
                    height: 8,
                    background: '#faad14',
                    border: '2px solid #fff',
                    cursor: 'crosshair',
                    zIndex: 10,
                  }}
                />
              </div>
            );
          })}

          {/* Render Default Route Row at the bottom */}
          <div
            style={{
              position: 'relative',
              background: '#f5f5f5',
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 32,
              marginTop: 2,
            }}
          >
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>
              default (默认)
            </Text>
            <Handle
              type="source"
              position={Position.Right}
              id="default"
              style={{
                position: 'absolute',
                right: -16,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 8,
                height: 8,
                background: '#8c8c8c',
                border: '2px solid #fff',
                cursor: 'crosshair',
                zIndex: 10,
              }}
            />
          </div>
        </div>
      ) : (
        data.features?.includes('status_tracking') && (
          <div
            style={{
              marginTop: 8,
              padding: '6px 10px',
              background: isConnected ? '#f6ffed' : '#f5f5f5',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: `1px solid ${isConnected ? '#b7eb8f' : '#d9d9d9'}`,
            }}
          >
            <Badge
              status={isConnected ? 'processing' : 'default'}
              color={isConnected ? '#52c41a' : '#bfbfbf'}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text
                strong={isConnected}
                style={{
                  fontSize: 11,
                  color: isConnected ? '#389e0d' : '#8c8c8c',
                }}
              >
                {status?.text || (isConnected ? '已连接' : '未激活')}
              </Text>
              {status?.detail && (
                <Text type="secondary" style={{ fontSize: 9 }}>
                  {status.detail}
                </Text>
              )}
            </div>
          </div>
        )
      )}
    </BaseNodeLayout>
  );
};

export default memo(PluginNode);
