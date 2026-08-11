import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Typography } from 'antd';
import { BranchesOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const { Text } = Typography;

const IfNode = (props) => {
  const { data, id } = props;
  const { t } = useTranslation();

  const customHandles = (
    <>
      <div style={{ position: 'absolute', right: 8, top: '40%', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: '10px', color: '#52c41a' }}>True</Text>
        <Handle
          type="source"
          position={Position.Right}
          id="true"
          style={{ position: 'relative', right: -12, width: 8, height: 8, background: '#52c41a', border: '2px solid #fff' }}
        />
      </div>
      <div style={{ position: 'absolute', right: 8, top: '60%', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: '10px', color: '#f5222d' }}>False</Text>
        <Handle
          type="source"
          position={Position.Right}
          id="false"
          style={{ position: 'relative', right: -12, width: 8, height: 8, background: '#f5222d', border: '2px solid #fff' }}
        />
      </div>
    </>
  );

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<BranchesOutlined />}
      color="#eb2f96"
      title={t('workflow.nodes.if.title')}
      subtitle={data.condition || 'No condition'}
      hideRightHandle={true}
      customHandles={customHandles}
    >
      {/* Redundant condition removed, shown in subtitle */}
    </BaseNodeLayout>
  );
};

export default IfNode;
