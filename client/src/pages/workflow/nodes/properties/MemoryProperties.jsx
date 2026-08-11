import React from 'react';
import { Form, InputNumber } from 'antd';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import VariableInput from '../../components/PropertyInputs/VariableInput';
import VariableDatePicker from '../../components/PropertyInputs/VariableDatePicker';

const MemoryProperties = ({ node, setNodes, currentNodeId, type }) => {
  const { t } = useTranslation();
  const activeType = type || node?.type;

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <Form.Item
        label={t(`workflow.nodes.${activeType}.convId`, 'Conversation ID')}
        name="conversationId"
        required
      >
        <VariableInput
          
          currentNodeId={currentNodeId || node?.id}
          placeholder="{{nodes.ensure.output.conversationId}}"
        />
      </Form.Item>

      <Form.Item label={t(`workflow.nodes.${activeType}.limit`, 'History Limit')} name="limit">
        <InputNumber min={1} max={99999} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        label={t('workflow.nodes.fetchMemory.afterTime', 'Starting From (Local Time)')}
        name="afterTime"
      >
        <VariableDatePicker
          
          currentNodeId={currentNodeId || node?.id}
          placeholder="{{nodes.read_var.output.value}}"
        />
      </Form.Item>
    </NodePropertyCollapse>
  );
};

export default MemoryProperties;
