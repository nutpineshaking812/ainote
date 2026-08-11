import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Typography, Tag, Space } from 'antd';
import { RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const { Text } = Typography;

const AIAgentNode = (props) => {
  const { data, selected, onOpenSettings, id } = props;
  const { t } = useTranslation();

  const customHandles = (
    <>
      {/* 底部专用能力插槽 (工具栏) */}
      <Handle
        id="tool-slot"
        type="target"
        position={Position.Bottom}
        style={{
          bottom: -6,
          left: '70%',
          transform: 'translateX(-50%)',
          width: 14,
          height: 14,
          background: '#722ed1', // 紫色专用于技能连接
          border: '3px solid #fff',
          borderRadius: '3px',
          zIndex: 10,
          boxShadow: selected ? '0 0 8px rgba(114, 46, 209, 0.5)' : 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -22,
          left: '70%',
          transform: 'translateX(-50%)',
          fontSize: '9px',
          fontWeight: 700,
          color: '#722ed1',
          background: '#f9f0ff',
          padding: '1px 6px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          border: '1px solid #d3adf7',
          pointerEvents: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}
      >
        <span>技能</span>
      </div>

      {/* 底部专用记忆插槽 (Memory) */}
      <Handle
        id="memory-slot"
        type="target"
        position={Position.Bottom}
        style={{
          bottom: -6,
          left: '30%',
          transform: 'translateX(-50%)',
          width: 14,
          height: 14,
          background: '#52c41a', // 绿色代表上下文/记忆流
          border: '3px solid #fff',
          borderRadius: '3px',
          zIndex: 10,
          boxShadow: selected ? '0 0 8px rgba(82, 196, 26, 0.5)' : 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -22,
          left: '30%',
          transform: 'translateX(-50%)',
          fontSize: '9px',
          fontWeight: 700,
          color: '#52c41a',
          background: '#f6ffed',
          padding: '1px 6px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          border: '1px solid #b7eb8f',
          pointerEvents: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}
      >
        <span>记忆</span>
      </div>

      {/* 底部长期记忆插槽 (Knowledge / Long-term Memory) */}
      <Handle
        id="knowledge-slot"
        type="target"
        position={Position.Bottom}
        style={{
          bottom: -6,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 14,
          height: 14,
          background: '#fa8c16', // 橙色代表长期知识库
          border: '3px solid #fff',
          borderRadius: '3px',
          zIndex: 10,
          boxShadow: selected ? '0 0 8px rgba(250, 140, 22, 0.5)' : 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -22,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '9px',
          fontWeight: 700,
          color: '#fa8c16',
          background: '#fff7e6',
          padding: '1px 6px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          border: '1px solid #ffd591',
          pointerEvents: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}
      >
        <span>知识</span>
      </div>
    </>
  );

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<RobotOutlined />}
      color="#13c2c2"
      title={t('workflow.nodes.aiAgent.title')}
      subtitle={data.model || 'gpt-4o'}
      customHandles={customHandles}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: 4 }}>
        <div
          style={{
            fontSize: '10px',
            color: '#595959',
            background: '#fafafa',
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid #f0f0f0',
            maxHeight: '40px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            fontStyle: data.prompt ? 'normal' : 'italic',
          }}
        >
          {data.prompt || 'No instructions set...'}
        </div>
      </div>
    </BaseNodeLayout>
  );
};

export default AIAgentNode;
