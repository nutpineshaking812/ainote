import React from 'react';
import { Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import VariableInput from '../../components/PropertyInputs/VariableInput';

const IfProperties = ({ node, setNodes, currentNodeId }) => {
  const { t } = useTranslation();

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <Form.Item label={t('workflow.designer.condition')} name="condition">
        <VariableInput 
          placeholder="{{nodeId.status}} === 200" 
          
          currentNodeId={currentNodeId || node?.id}
        />
      </Form.Item>
    </NodePropertyCollapse>
  );
};

export default IfProperties;
