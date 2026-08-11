import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Typography } from 'antd';
import { RetweetOutlined, SyncOutlined, LogoutOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const { Text } = Typography;

const WhileNode = (props) => {
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
          color: '#722ed1',
          background: '#f9f0ff',
          padding: '1px 6px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          border: '1px solid #d3adf7',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}
      >
        <span>Repeat</span>
      </div>
      <div style={{ position: 'absolute', right: 8, top: '40%', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: '10px', color: '#1890ff' }}>Loop</Text>
        <Handle
          type="source"
          position={Position.Right}
          id="loop"
          style={{ position: 'relative', right: -12, width: 8, height: 8, background: '#1890ff', border: '2px solid #fff' }}
        />
      </div>
      <div style={{ position: 'absolute', right: 8, top: '60%', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: '10px', color: '#595959' }}>Exit</Text>
        <Handle
          type="source"
          position={Position.Right}
          id="exit"
          style={{ position: 'relative', right: -12, width: 8, height: 8, background: '#595959', border: '2px solid #fff' }}
        />
      </div>
    </>
  );

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<RetweetOutlined />}
      color="#722ed1"
      title={t('workflow.nodes.while.title')}
      subtitle={data.condition || 'No condition'}
      hideRightHandle={true}
      showTopHandle={true}
      customHandles={customHandles}
    >
      {/* Redundant condition removed, shown in subtitle */}
    </BaseNodeLayout>
  );
};

export default WhileNode;
