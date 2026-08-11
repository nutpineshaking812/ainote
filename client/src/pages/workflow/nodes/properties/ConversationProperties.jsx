import React from 'react';
import { Form, Select, Input, InputNumber, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import VariableInput from '../../components/PropertyInputs/VariableInput';
import VariableDatePicker from '../../components/PropertyInputs/VariableDatePicker';

const ConversationProperties = ({ node, setNodes, currentNodeId, type }) => {
  const { t } = useTranslation();

  const activeType = type || node?.type;

  const renderFields = () => {
    switch (activeType) {
      case 'addMessage':
        return (
          <>
            <Form.Item
              label={t('workflow.nodes.addMessage.convId', 'Conversation ID')}
              name="conversationId"
              required
            >
              <VariableInput
                currentNodeId={currentNodeId || node?.id}
                placeholder="{{nodes.ensure.output.conversationId}}"
              />
            </Form.Item>
            <Form.Item label={t('workflow.nodes.addMessage.role', 'Message Role')} name="role">
              <Select
                options={[
                  { label: t('workflow.nodes.addMessage.roles.user', 'User'), value: 'user' },
                  {
                    label: t('workflow.nodes.addMessage.roles.assistant', 'Assistant'),
                    value: 'assistant',
                  },
                  { label: t('workflow.nodes.addMessage.roles.system', 'System'), value: 'system' },
                ]}
              />
            </Form.Item>
            <Form.Item
              label={t('workflow.nodes.addMessage.content', 'Message Content')}
              name="content"
              required
            >
              <VariableInput mode="preview" rows={4} currentNodeId={currentNodeId || node?.id} />
            </Form.Item>
            <Form.Item
              label={t('workflow.nodes.addMessage.openBubble', 'Open Chat Bubble?')}
              name="openBubble"
              valuePropName="checked"
              tooltip={t(
                'workflow.nodes.addMessage.openBubbleDesc',
                'Enabling this will automatically create an assistant reply bubble in the UI (Session:Ready).',
              )}
            >
              <Switch />
            </Form.Item>
          </>
        );
      case 'sendSseEvent':
        return (
          <>
            <Form.Item
              label={t('workflow.nodes.sendSseEvent.status', 'Event Status (e.g., thinking)')}
              name="status"
              required
            >
              <VariableInput
                placeholder="custom_thinking"
                currentNodeId={currentNodeId || node?.id}
              />
            </Form.Item>
            <Form.Item
              label={t('workflow.nodes.sendSseEvent.content', 'Event Content')}
              name="content"
            >
              <VariableInput currentNodeId={currentNodeId || node?.id} />
            </Form.Item>
          </>
        );
      case 'buildAnalysisQuery':
        return (
          <Form.Item
            label={t('workflow.nodes.buildAnalysisQuery.task', 'Analysis Task Object')}
            name="task"
            required
          >
            <VariableInput
              currentNodeId={currentNodeId || node?.id}
              placeholder="{{nodes.planner.output.intent.task}}"
            />
          </Form.Item>
        );
      case 'mongoAggregate':
        return (
          <Form.Item
            label={t('workflow.nodes.mongoAggregate.pipeline', 'Aggregation Pipeline')}
            name="pipeline"
            required
          >
            <VariableInput
              currentNodeId={currentNodeId || node?.id}
              placeholder="{{nodes.build.output.pipeline}}"
              mode="preview"
              rows={4}
            />
          </Form.Item>
        );
      default:
        return null;
    }
  };

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      {renderFields()}
    </NodePropertyCollapse>
  );
};

export default ConversationProperties;
