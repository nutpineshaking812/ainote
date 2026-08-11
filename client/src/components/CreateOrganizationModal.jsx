import React, { useState } from 'react';
import { Modal, Form, Input, message, Typography, Space } from 'antd';
import { AppstoreOutlined, RocketOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { createOrganization } from '../api/organizations';
import { useOrg } from '../store/OrgContext';

const { Text, Paragraph } = Typography;

const CreateOrganizationModal = ({ open, onCancel, onSuccess }) => {
  const { t } = useTranslation();
  const { refreshOrganizations } = useOrg();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      const response = await createOrganization({
        name: values.name,
        description: values.description || '',
      });
      
      message.success(t('onboarding.organization.createSuccess') || '组织创建成功！');
      
      // Refresh the organization list
      await refreshOrganizations();
      
      form.resetFields();
      if (onSuccess) {
        onSuccess(response.organization);
      }
    } catch (error) {
      if (error.name !== 'ValidationError') {
        console.error('Create organization failed:', error);
        message.error(error.response?.data?.error || t('onboarding.organization.createFailed') || '创建失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('onboarding.organization.title') || '创建新组织'}
      open={open}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleCreate}
      confirmLoading={loading}
      okText={t('common.create') || '创建'}
      cancelText={t('common.cancel') || '取消'}
      width={480}
      centered
    >
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <Space direction="vertical" align="center">
          <RocketOutlined style={{ fontSize: 32, color: '#1890ff' }} />
          <Paragraph type="secondary" style={{ margin: 0 }}>
            {t('onboarding.organization.subtitle') || '组织是您和团队协作的地方'}
          </Paragraph>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Form.Item
          name="name"
          label={t('onboarding.organization.nameLabel') || '组织名称'}
          rules={[
            { required: true, message: t('onboarding.organization.nameRequired') || '请输入组织名称' },
            { whitespace: true, message: t('onboarding.organization.nameRequired') || '请输入组织名称' },
            { min: 2, message: t('onboarding.organization.nameTooShort') || '组织名称至少2个字符' },
          ]}
        >
          <Input
            prefix={<AppstoreOutlined />}
            placeholder={t('onboarding.organization.namePlaceholder') || '例如：我的团队'}
            size="large"
            autoFocus
          />
        </Form.Item>

        <Form.Item
          name="description"
          label={t('onboarding.organization.descLabel') || '描述（可选）'}
        >
          <Input.TextArea
            placeholder={t('onboarding.organization.descPlaceholder') || '简单描述一下您的组织'}
            rows={3}
          />
        </Form.Item>
      </Form>
      
      <div
        style={{
          background: '#f0f5ff',
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid #adc6ff',
          marginTop: 16
        }}
      >
        <Text type="secondary" style={{ fontSize: 13 }}>
          💡 {t('onboarding.organization.tip') || '创建组织后，您可以邀请团队成员并开始协作'}
        </Text>
      </div>
    </Modal>
  );
};

export default CreateOrganizationModal;
