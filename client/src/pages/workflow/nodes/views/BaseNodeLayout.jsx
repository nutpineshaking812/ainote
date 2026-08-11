import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, Typography, Space, Button, Tooltip } from 'antd';
import {
  SettingOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const BaseNodeLayout = ({
  id,
  data,
  selected,
  onOpenSettings,
  icon,
  color = '#1890ff',
  title,
  subtitle,
  children,
  hideLeftHandle = false,
  hideRightHandle = false,
  leftHandleProps = {},
  rightHandleProps = {},
  showTopHandle = false,
  topHandleProps = {},
  customHandles,
  statusNode,
}) => {
  const { t } = useTranslation();
  const isRunning = data?.status === 'running';
  const isSuccess = data?.status === 'success';
  const isError = data?.status === 'error';

  const primaryColor = isError ? '#ff4d4f' : isSuccess ? '#52c41a' : color;

  return (
    <div className={`node-layout-container ${isRunning ? 'is-running' : ''}`} style={{ position: 'relative' }}>
      {/* Target Handle (Input) */}
      {!hideLeftHandle && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ 
            width: 8, 
            height: 8, 
            background: '#fff', 
            border: `2px solid ${primaryColor}`,
            left: -4,
            zIndex: 10,
            ...leftHandleProps.style 
          }}
          {...leftHandleProps}
        />
      )}

      {/* Target Handle (Top) - Used for loop back-flow */}
      {showTopHandle && (
        <Handle
          type="target"
          id="loop-in"
          position={Position.Top}
          style={{ 
            width: 14, 
            height: 14, 
            background: color, 
            border: `3px solid #fff`,
            borderRadius: '3px',
            top: -7,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            cursor: 'crosshair',
            ...topHandleProps.style 
          }}
          isConnectable={true}
          {...topHandleProps}
        />
      )}

      {/* Node Body using Card to maintain original style */}
      <Card
        size="small"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Space size={8}>
              {isRunning ? (
                <LoadingOutlined style={{ color: primaryColor }} />
              ) : (
                <div style={{ color: primaryColor, display: 'flex', fontSize: '16px' }}>{icon}</div>
              )}
              <Text strong style={{ fontSize: '13px' }}>{title}</Text>
              {statusNode}
            </Space>
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />}
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings({ id, data });
              }}
              className="node-settings-btn"
            />
          </div>
        }
        style={{
          width: 220,
          minHeight: 140,
          height: 'auto',
          borderRadius: '12px',
          border: `2px solid ${selected ? primaryColor : isRunning ? primaryColor : '#f0f0f0'}`,
          boxShadow: isRunning 
            ? `0 0 15px ${primaryColor}33` 
            : selected ? `0 0 15px ${primaryColor}4D` : '0 2px 8px rgba(0,0,0,0.05)',
          transition: 'all 0.3s',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'visible'
        }}
        bodyStyle={{ 
          padding: '12px', 
          flex: 1, 
          overflow: 'visible', 
          display: 'flex', 
          flexDirection: 'column' 
        }}
      >
        {subtitle && (
          <Tooltip title={subtitle}>
            <Text 
              type="secondary" 
              style={{ 
                fontSize: '11px', 
                display: 'block', 
                marginBottom: 4,
                width: '100%',
                textAlign: 'left'
              }}
            >
              {(() => {
                const str = String(subtitle);
                if (str.length <= 30) return str;
                const start = 14;
                const end = 12;
                return `${str.substring(0, start)}...${str.substring(str.length - end)}`;
              })()}
            </Text>
          </Tooltip>
        )}
        
        <div style={{ flex: 1, overflow: 'visible' }}>
          {children}
        </div>

        {/* Status Indicators */}
        {(isSuccess || isError) && (
          <div style={{ 
            position: 'absolute', 
            bottom: 8, 
            right: 8,
            zIndex: 5
          }}>
            {isSuccess ? 
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '14px' }} /> : 
              <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '14px' }} />
            }
          </div>
        )}
      </Card>

      {/* Source Handle (Output) */}
      {!hideRightHandle && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ 
            width: 8, 
            height: 8, 
            background: primaryColor, 
            border: '2px solid #fff',
            right: -4,
            zIndex: 10,
            ...rightHandleProps.style 
          }}
          {...rightHandleProps}
        />
      )}

      {/* Custom Handles */}
      {customHandles}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes node-pulse-${primaryColor.replace('#','')} {
          0% { box-shadow: 0 0 0 0 ${primaryColor}4D; }
          70% { box-shadow: 0 0 0 8px ${primaryColor}00; }
          100% { box-shadow: 0 0 0 0 ${primaryColor}00; }
        }
        .node-layout-container.is-running .ant-card {
          animation: node-pulse-${primaryColor.replace('#','')} 1.5s infinite;
        }
        .node-settings-btn {
          opacity: 0.4;
          transition: opacity 0.2s;
        }
        .node-layout-container:hover .node-settings-btn {
          opacity: 1;
        }
      `}} />
    </div>
  );
};

export default BaseNodeLayout;
