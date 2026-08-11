import React from 'react';
import { Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import { PROPERTY_INPUTS_REGISTRY } from '../../components/PropertyInputs';

const LogProperties = ({ node, setNodes, currentNodeId }) => {
  const { t } = useTranslation();
  const VariableInput = PROPERTY_INPUTS_REGISTRY.variableInput;

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <Form.Item label={t('workflow.designer.message')} name="message">
        <VariableInput
          rows={4}
          placeholder={t(
            'workflow.designer.logPlaceholder',
            'Enter log message, use {{nodeId.result}} for variables',
          )}
          currentNodeId={currentNodeId || node?.id}
        />
      </Form.Item>
    </NodePropertyCollapse>
  );
};

export default LogProperties;
