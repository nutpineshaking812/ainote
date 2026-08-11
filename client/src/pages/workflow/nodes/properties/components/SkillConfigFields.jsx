import React from 'react';
import { Form, Input, Checkbox, Divider, Space } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ParameterList from './ParameterList';

const SkillConfigFields = () => {
  const { t } = useTranslation();

  return (
    <>
      <Divider orientation="left">
        <Space>
          <RobotOutlined />
          {t('workflow.nodes.skill.aiTitle', 'AI Skill Configuration')}
        </Space>
      </Divider>

      <Form.Item name="isSkill" valuePropName="checked">
        <Checkbox>{t('workflow.nodes.skill.enableSkill', 'Register as AI Skill')}</Checkbox>
      </Form.Item>

      <Form.Item noStyle dependencies={['isSkill']}>
        {({ getFieldValue }) =>
          getFieldValue('isSkill') && (
            <>
              <Form.Item
                label={t('workflow.nodes.skill.toolName', 'Tool Name')}
                name="toolName"
                rules={[
                  { pattern: /^[a-zA-Z0-9_]+$/, message: 'Alpha-numeric and underscore only' },
                ]}
              >
                <Input placeholder="e.g. get_user_info" />
              </Form.Item>
              <Form.Item
                label={t('workflow.nodes.skill.description', 'Tool Description')}
                name="description"
              >
                <Input.TextArea placeholder="Describe what this tool does for AI" rows={2} />
              </Form.Item>

              <Form.Item
                label={t('workflow.nodes.skill.inputParams', 'Input Schema (Parameters)')}
                name="inputParameters"
              >
                <ParameterList />
              </Form.Item>

              <Form.Item
                label={t('workflow.nodes.skill.outputParams', 'Output Schema (Return Result)')}
                name="outputParameters"
              >
                <ParameterList />
              </Form.Item>
            </>
          )
        }
      </Form.Item>
    </>
  );
};

export default SkillConfigFields;
