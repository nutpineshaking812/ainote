import React, { useState } from 'react';
import { Modal, Form, Input, message, Typography, Space } from 'antd';
import { KeyOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { joinOrganization } from '../api/organizations';
import { useOrg } from '../store/OrgContext';

const { Text, Paragraph } = Typography;

const JoinOrganizationModal = ({ open, onCancel, onSuccess }) => {
  const { t } = useTranslation();
  const { refreshOrganizations } = useOrg();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleJoin = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      const response = await joinOrganization(values.code.trim());
      
      message.success(t('organization.joinSuccess') || '成功加入组织！');
      
      // Refresh the organization list
      await refreshOrganizations();
      
      form.resetFields();
      if (onSuccess) {
        onSuccess(response.organization);
      }
    } catch (error) {
      if (error.name !== 'ValidationError') {
        console.error('Join organization failed:', error);
        message.error(error.response?.data?.error || t('organization.joinFailed') || '加入失败，请检查邀请码是否有效');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('organization.joinTitle') || '加入新组织'}
      open={open}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleJoin}
      confirmLoading={loading}
      okText={t('common.confirm') || '加入'}
      cancelText={t('common.cancel') || '取消'}
      width={400}
      centered
    >
      <div style={{ marginBottom: 20, textAlign: 'center' }}>
        <Space direction="vertical" align="center">
          <TeamOutlined style={{ fontSize: 32, color: '#00b96b' }} />
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {t('organization.joinSubtitle') || '输入组织邀请码加入已有团队'}
          </Paragraph>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Form.Item
          name="code"
          label={t('organization.inviteCodeLabel') || '邀请码'}
          rules={[
            { required: true, message: t('organization.inviteCodeRequired') || '请输入组织邀请码' },
            { whitespace: true, message: t('organization.inviteCodeRequired') || '请输入组织邀请码' },
          ]}
        >
          <Input
            prefix={<KeyOutlined />}
            placeholder={t('organization.inviteCodePlaceholder') || '请输入邀请码（例如：ABCD1234）'}
            size="large"
            autoFocus
          />
        </Form.Item>
      </Form>
      
      <div
        style={{
          background: '#f6ffed',
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid #b7eb8f',
          marginTop: 16
        }}
      >
        <Text type="secondary" style={{ fontSize: 13, color: '#389e0d' }}>
          💡 {t('organization.joinTip') || '加入组织后，您可以在组织切换面板中随时切换工作空间'}
        </Text>
      </div>
    </Modal>
  );
};

export default JoinOrganizationModal;
