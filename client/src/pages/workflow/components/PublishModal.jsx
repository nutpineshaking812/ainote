import React, { useState, useEffect } from 'react';
import { Modal, Typography, Descriptions, Tag, Alert, Divider, Tabs, Switch, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { RobotOutlined } from '@ant-design/icons';
import XMarkdownDisplay from '../../../components/common/XMarkdownDisplay';

const { Text, Paragraph } = Typography;

const PublishModal = ({ open, onClose, workflow, onPublish, loading }) => {
  const { t } = useTranslation();
  const [isSkill, setIsSkill] = useState(false);

  useEffect(() => {
    if (workflow) {
      setIsSkill(workflow.isSkill || false);
    }
  }, [workflow, open]);

  const handleOk = () => {
    onPublish({
      ...workflow,
      scope: 'ORGANIZATION',
      isSkill: isSkill,
      skillConfig: workflow?.skillConfig || {},
    });
  };

  if (!workflow) return null;

  return (
    <Modal
      title={t('workflow.publish.title', 'Publish Workflow')}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      okText={t('workflow.publish.confirm', 'Confirm and Publish')}
      cancelText={t('common.cancel', 'Cancel')}
      width={640}
    >
      <div style={{ marginBottom: 20 }}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={t('workflow.publish.skillName', 'Skill Name')}>
            {workflow.skillConfig?.name || workflow.name}
          </Descriptions.Item>
          <Descriptions.Item label={t('workflow.publish.scope', 'Target Scope')}>
            <Tag color="purple">{t('workflow.publish.scopeOrg', 'Organization')}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('workflow.designer.isSkill', 'AI Capability')}>
            <Space>
              <Switch
                checked={isSkill}
                onChange={setIsSkill}
                size="small"
                checkedChildren={t('common.enable')}
                unCheckedChildren={t('common.disable')}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {isSkill
                  ? t('workflow.designer.isSkillEnabledDesc', 'Available as AI Tool')
                  : t('workflow.designer.isSkillDisabledDesc', 'Internal workflow only')}
              </Text>
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </div>

      {isSkill && (
        <div style={{ marginTop: 16 }}>
          <Text strong>
            <RobotOutlined style={{ marginRight: 8 }} />
            {t('workflow.publish.skillDesc', 'Skill Instruction (AI Prompt)')}:
          </Text>
          <Paragraph
            ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}
            style={{
              padding: '8px 12px',
              background: '#f5f5f5',
              borderRadius: 4,
              marginTop: 8,
              fontSize: 13,
            }}
          >
            {workflow.skillConfig?.description || (
              <Text type="danger">{t('common.notConfigured', 'Not Configured')}</Text>
            )}
          </Paragraph>
          {!workflow.skillConfig?.description && (
            <Alert
              message={t(
                'workflow.designer.skillConfigMissingDesc',
                "AI Skill description is missing. AI won't know when to use this tool.",
              )}
              type="warning"
              showIcon
              style={{ marginTop: 8 }}
            />
          )}

          <Divider style={{ margin: '16px 0' }} />

          <Tabs
            defaultActiveKey="input"
            items={[
              {
                key: 'input',
                label: t('workflow.nodes.skill.inputParams'),
                children: (
                  <div
                    style={{
                      height: 180,
                      overflowY: 'auto',
                      background: '#fafafa',
                      borderRadius: 4,
                      padding: 4,
                    }}
                  >
                    <XMarkdownDisplay>
                      {`\`\`\`json\n${JSON.stringify(workflow.skillConfig?.inputSchema || {}, null, 2)}\n\`\`\``}
                    </XMarkdownDisplay>
                  </div>
                ),
              },
              {
                key: 'output',
                label: t('workflow.nodes.skill.outputParams'),
                children: (
                  <div
                    style={{
                      height: 180,
                      overflowY: 'auto',
                      background: '#fafafa',
                      borderRadius: 4,
                      padding: 4,
                    }}
                  >
                    <XMarkdownDisplay>
                      {`\`\`\`json\n${JSON.stringify(workflow.skillConfig?.outputSchema || {}, null, 2)}\n\`\`\``}
                    </XMarkdownDisplay>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {isSkill
            ? t(
                'workflow.publish.confirmWithSkill',
                'This will publish the workflow and register it as an AI skill for the organization.',
              )
            : t(
                'workflow.publish.confirmWithoutSkill',
                'This will publish the workflow to the organization, but it will NOT be exposed to AI.',
              )}
        </Text>
      </div>
    </Modal>
  );
};

export default PublishModal;
