import React, { useEffect } from 'react';
import { Typography, Space, Tooltip, Divider, Form } from 'antd';
import { InfoCircleOutlined, SendOutlined } from '@ant-design/icons';
import NodePropertyCollapse from './NodePropertyCollapse';
import SchemaConfigList from './SchemaConfigList';

const { Text } = Typography;

const EndProperties = ({ node, setNodes, currentNodeId }) => {
  const { data } = node;

  /**
   * 💡 核心设计:
   * 我们不再在这里自创 Form，而是依赖 NodePropertyCollapse 注入的 Context。
   * 下层组件 OutputMappingList 会通过 useFormInstance 自动挂载。
   */

  // 这里的 onValuesChange 会被 NodePropertyCollapse 的 defaultHandleValuesChange 调用
  const handleValuesChange = (allValues, next) => {
    // 处理迁移：如果在保存时发现了 mapping (旧)，则自动转化为 outputs (新)
    if (allValues.mapping && !allValues.outputs) {
      allValues.outputs = allValues.mapping;
      delete allValues.mapping;
    }
    next(allValues);
  };

  return (
    <NodePropertyCollapse
      node={node}
      setNodes={setNodes}
      onValuesChange={handleValuesChange}
      hideOutput
    >
      <SchemaConfigList
        mode="output"
        
        currentNodeId={currentNodeId || node?.id}
        node={node}
        setNodes={setNodes}
      />
    </NodePropertyCollapse>
  );
};

export default EndProperties;
