import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Typography, Space, Tag } from 'antd';
import { SyncOutlined, ArrowRightOutlined, LogoutOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const { Text } = Typography;

const ForNode = (props) => {
  const { data, id } = props;
  const { t } = useTranslation();

  const customHandles = (
    <>
      <div 
        style={{ 
          position: 'absolute', 
          top: -24, 
          left: '50%', 
          transform: 'translateX(-50%)', 
          pointerEvents: 'none',
          fontSize: '9px',
          fontWeight: 700,
          color: '#2f54eb',
          background: '#f0f5ff',
          padding: '1px 6px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          border: '1px solid #adc6ff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}
      >
        <span>Repeat</span>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 8,
          top: '40%',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Text style={{ fontSize: '10px', color: '#1890ff' }}>Loop</Text>
        <Handle
          type="source"
          position={Position.Right}
          id="loop"
          style={{
            position: 'relative',
            right: -12,
            width: 8,
            height: 8,
            background: '#1890ff',
            border: '2px solid #fff',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 8,
          top: '60%',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Text style={{ fontSize: '10px', color: '#595959' }}>Done</Text>
        <Handle
          type="source"
          position={Position.Right}
          id="exit"
          style={{
            position: 'relative',
            right: -12,
            width: 8,
            height: 8,
            background: '#595959',
            border: '2px solid #fff',
          }}
        />
      </div>
    </>
  );

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<SyncOutlined />}
      color="#2f54eb"
      title={t('workflow.nodes.for.title')}
      subtitle={data.iterator ? `${data.iterator}` : `${data.limit || 10} Times`}
      hideRightHandle={true}
      showTopHandle={true}
      customHandles={customHandles}
    >
      {/* Redundant content removed */}
    </BaseNodeLayout>
  );
};

export default ForNode;
