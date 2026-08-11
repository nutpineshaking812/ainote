import React, { useRef, useState } from 'react';
import { Form, Select, Input, Tooltip, Button, Space, Divider, Switch } from 'antd';
import { RobotOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import VariableInput from '../../components/PropertyInputs/VariableInput';
import AIPromptManager from '../../../../components/AIPromptManager';

const DingTalkRobotProperties = ({ node, setNodes, currentNodeId }) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const msgType = Form.useWatch('msgType', form);
  const contentRef = useRef(null);
  const [promptManagerOpen, setPromptManagerOpen] = useState(false);

  const handlePromptSelect = (template) => {
    if (contentRef.current) {
        contentRef.current.insertText(template.textContent || template.contentPlain || '');
    }
  };

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <Form.Item 
        label={t('workflow.designer.webhookUrl')} 
        name="webhook" 
        rules={[
          { required: true, message: 'Webhook URL is required' },
          { type: 'url', message: 'Please enter a valid URL' }
        ]}
      >
        <Input placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
      </Form.Item>

      <Form.Item 
        label={
          <Space size={4}>
            {t('workflow.designer.secret')}
            <Tooltip title="If signature is enabled in DingTalk bot settings, paste the SEC... secret here.">
              <QuestionCircleOutlined />
            </Tooltip>
          </Space>
        } 
        name="secret"
        rules={[
          {
            validator: (_, value) => {
              if (value && (value.startsWith('http') || value.includes('access_token'))) {
                return Promise.reject(new Error('Secret should not be a URL. Please paste the "SEC..." string from DingTalk security settings.'));
              }
              return Promise.resolve();
            }
          }
        ]}
      >
        <Input.Password placeholder="SEC..." visibilityToggle />
      </Form.Item>

      <Form.Item 
        label={t('workflow.designer.msgType')} 
        name="msgType" 
        initialValue="text"
      >
        <Select
          options={[
            { label: 'Text', value: 'text' },
            { label: 'Markdown', value: 'markdown' },
          ]}
        />
      </Form.Item>

      {msgType === 'markdown' && (
        <Form.Item 
          label={t('workflow.designer.title')} 
          name="title"
          rules={[{ required: true, message: 'Markdown title is required' }]}
        >
          <VariableInput 
            placeholder="Notification Summary (displayed in push notifications)" 
            
            currentNodeId={currentNodeId || node?.id}
          />
        </Form.Item>
      )}

      <Form.Item 
        label={t('workflow.designer.content')} 
        name="content"
        rules={[{ required: true, message: 'Message content is required' }]}
        style={{ marginBottom: 16 }}
      >
        <VariableInput 
          ref={contentRef}
          mode="preview"
          rows={8} 
          
          currentNodeId={currentNodeId || node?.id}
          placeholder={msgType === 'markdown' ? '# Title\n- Content here' : 'Message details...'}
          extra={
            <Tooltip title={t('workflow.designer.openPromptLibrary', 'AI Prompt Library')}>
                <Button 
                    size="small" 
                    type="text" 
                    icon={<RobotOutlined style={{ fontSize: 14, color: '#8c8c8c' }} />} 
                    onClick={() => setPromptManagerOpen(true)}
                    style={{ background: '#f5f5f5', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                />
            </Tooltip>
          }
        />
      </Form.Item>

      <Divider orientation="left" plain style={{ margin: '16px 0 8px 0', fontSize: '12px' }}>
        {t('workflow.nodes.dingTalkRobot.atConfig', 'At Configuration')}
      </Divider>

      <Form.Item label={t('workflow.designer.atAll')} name="atAll" valuePropName="checked">
        <Switch size="small" />
      </Form.Item>

      <Form.Item label={t('workflow.designer.atMobiles')} name="atMobiles">
        <VariableInput 
          placeholder="150..., 138..." 
          
          currentNodeId={currentNodeId || node?.id}
        />
      </Form.Item>

      <Form.Item label={t('workflow.designer.atUserIds')} name="atUserIds">
        <VariableInput 
          placeholder="user123, user456" 
          
          currentNodeId={currentNodeId || node?.id}
        />
      </Form.Item>

      <AIPromptManager
        open={promptManagerOpen}
        onClose={() => setPromptManagerOpen(false)}
        onSelect={handlePromptSelect}
        defaultOnlyApp={false}
      />
    </NodePropertyCollapse>
  );
};

export default DingTalkRobotProperties;
