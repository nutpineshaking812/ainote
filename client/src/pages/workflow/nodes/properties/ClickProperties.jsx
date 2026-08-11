import React from 'react';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import SchemaConfigList from './SchemaConfigList';

const { Text } = Typography;
const ClickProperties = ({ node, setNodes }) => {
  const { t } = useTranslation();

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <div style={{ padding: '0 4px 12px 4px', color: '#8c8c8c' }}>
        <Text type="secondary" style={{ fontSize: '11px' }}>
          {t('workflow.nodes.click.noSettings', '可以自定义点击工作流时弹窗需要填写的参数表单。')}
        </Text>
      </div>
      <SchemaConfigList
        mode="input"
        label="输入定义 (Input Schema)"
        node={node}
        setNodes={setNodes}
      />
    </NodePropertyCollapse>
  );
};

export default ClickProperties;
