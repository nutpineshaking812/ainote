import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, Typography, Space, Tag } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import BaseNodeLayout from './BaseNodeLayout';

const { Text } = Typography;

const EndNode = (props) => {
  const { data, selected } = props;
  const mapping = data.mapping || [];

  return (
    <BaseNodeLayout
      {...props}
      title="结束并在输出"
      icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
      color="#52c41a"
    >
      <div style={{ padding: '8px 4px' }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {mapping.length > 0 ? (
            mapping.slice(0, 3).map((m, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <Text type="secondary">{m.name}:</Text>
                <Tag color="green" style={{ margin: 0 }}>{String(m.value).length > 15 ? '...' : m.value}</Tag>
              </div>
            ))
          ) : (
            <Text type="secondary" italic>未匹配输出字段</Text>
          )}
          {mapping.length > 3 && <Text type="secondary" style={{ fontSize: '10px' }}>+ 更多输出...</Text>}
        </Space>
      </div>
      
      {/* 强约束：End 只有 Input 没有 Output */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{ background: '#555', width: 8, height: 8 }}
      />
    </BaseNodeLayout>
  );
};

export default EndNode;
