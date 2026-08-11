import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Typography } from 'antd';
import { SettingOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const AddonNodeLayout = ({
  data,
  selected,
  onOpenSettings,
  id,
  icon,
  primaryColor = '#722ed1',
  title,
  subtitle,
  children,
}) => {
  const { t } = useTranslation();
  const isRunning = data.status === 'running';

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* 顶部插槽接入点 (连接到 AI Agent 底部) */}
      <Handle
        type="source"
        id="addon-output"
        position={Position.Top}
        style={{ 
          width: 8, 
          height: 8, 
          background: primaryColor, 
          border: '2px solid #fff',
          top: -4,
          zIndex: 10,
        }}
      />

      {/* 节点主体 紧凑的 addon 形状 */}
      <div
        className={`addon-node ${isRunning ? 'is-running' : ''}`}
        style={{
          width: 56,
          height: 56,
          borderRadius: '16px',
          background: '#fff',
          border: `2.5px solid ${selected ? primaryColor : isRunning ? primaryColor : '#e0e0e0'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isRunning 
            ? `0 0 15px ${primaryColor}66` // hex alpha
            : selected ? `0 0 0 4px ${primaryColor}1a` : '0 2px 6px rgba(0,0,0,0.04)',
          position: 'relative',
          transition: 'all 0.3s ease',
        }}
      >
        {isRunning ? (
          <LoadingOutlined style={{ fontSize: '24px', color: primaryColor }} />
        ) : (
          <div style={{ fontSize: '24px', color: primaryColor, display: 'flex' }}>
            {icon}
          </div>
        )}

        {/* 悬浮设置按钮 */}
        <div 
          className="node-settings-trigger"
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            width: 20,
            height: 20,
            background: '#fff',
            border: `1px solid ${primaryColor}`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            opacity: selected ? 1 : 0,
            visibility: selected ? 'visible' : 'hidden',
            zIndex: 11
          }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings({ id, data });
          }}
        >
          <SettingOutlined style={{ fontSize: '10px', color: '#595959' }} />
        </div>

        {/* 对于某些可能有角标或者内部子元素的addon进行渲染 */}
        {children}
      </div>

      {/* 底部浮动标签 */}
      <div style={{ 
        marginTop: 8, 
        textAlign: 'center', 
        width: 120,
        pointerEvents: 'none'
      }}>
        <Text strong style={{ 
          fontSize: '12px', 
          color: (selected || isRunning) ? '#262626' : '#595959',
          display: 'block'
        }}>
          {data.label || title}
        </Text>
        <Text type="secondary" style={{ fontSize: '10px', display: 'block', lineHeight: 1, color: isRunning ? primaryColor : '#8c8c8c' }}>
          {isRunning 
            ? (data.lastProgress?.toolName || t('workflow.nodes.addon.executing', 'Running...')) 
            : subtitle}
        </Text>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes addon-pulse-${primaryColor.replace('#','')} {
          0% { box-shadow: 0 0 0 0 ${primaryColor}66; }
          70% { box-shadow: 0 0 0 10px ${primaryColor}00; }
          100% { box-shadow: 0 0 0 0 ${primaryColor}00; }
        }
        .addon-node.is-running {
          animation: addon-pulse-${primaryColor.replace('#','')} 1.5s infinite;
          border-color: ${primaryColor} !important;
        }
        .addon-node:hover .node-settings-trigger {
          opacity: 1 !important;
          visibility: visible !important;
        }
      `}} />
    </div>
  );
};

export default AddonNodeLayout;
