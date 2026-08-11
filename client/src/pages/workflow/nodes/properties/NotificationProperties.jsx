import React from 'react';
import { Form, Select, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import VariableInput from '../../components/PropertyInputs/VariableInput';

const NotificationProperties = ({ node, setNodes, currentNodeId }) => {
  const { t } = useTranslation();

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <Form.Item label={t('workflow.designer.title')} name="title">
        <VariableInput 
          placeholder="Notification Title" 
          
          currentNodeId={currentNodeId || node?.id}
        />
      </Form.Item>
      <Form.Item label={t('workflow.designer.content')} name="content">
        <VariableInput 
          rows={4} 
          placeholder="Hello {{nodeId.result}}..." 
          
          currentNodeId={currentNodeId || node?.id}
        />
      </Form.Item>
    </NodePropertyCollapse>
  );
};

export default NotificationProperties;
