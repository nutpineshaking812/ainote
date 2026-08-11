import React from 'react';
import { Form } from 'antd';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import VariableInput from '../../components/PropertyInputs/VariableInput';

const ForProperties = ({ node, setNodes, currentNodeId }) => {
  const { t } = useTranslation();

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <Form.Item 
        label={t('workflow.designer.iterator', 'Iterator')}
        name="iterator"
      >
        <VariableInput 
          
          currentNodeId={currentNodeId || node?.id} 
          placeholder="{{previousNode.items}}" 
        />
      </Form.Item>
      <Form.Item label={t('workflow.designer.limit', 'Limit')} name="limit">
        <VariableInput 
          
          currentNodeId={currentNodeId || node?.id} 
          placeholder="10" 
        />
      </Form.Item>
    </NodePropertyCollapse>
  );
};

export default ForProperties;
