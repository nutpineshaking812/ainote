import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Space, message } from 'antd';
import { AppstoreOutlined, RocketOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { createOrganization } from '../api/organizations';
import { useOrg } from '../store/OrgContext';
import './Auth.css';

const { Title, Text, Paragraph } = Typography;

const OnboardingOrganization = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loadOrganizations } = useOrg();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = async (values) => {
    try {
      setLoading(true);
      await createOrganization({
        name: values.name,
        description: values.description || '',
      });
      
      message.success(t('onboarding.organization.createSuccess') || '组织创建成功！');
      
      // Reload organizations to get the newly created one
      await loadOrganizations();
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      message.error(error.response?.data?.error || t('onboarding.organization.createFailed') || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <Card
        className="auth-card"
        style={{
          maxWidth: 500,
          width: '100%',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <RocketOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
            <Title level={2} style={{ marginBottom: 8 }}>
              {t('onboarding.organization.title') || '创建您的组织'}
            </Title>
            <Paragraph type="secondary">
              {t('onboarding.organization.subtitle') || '组织是您和团队协作的地方'}
            </Paragraph>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreate}
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

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                block
                style={{ marginTop: 8 }}
              >
                {t('onboarding.organization.createButton') || '创建组织'}
              </Button>
            </Form.Item>
          </Form>

          <div
            style={{
              background: '#f0f5ff',
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #adc6ff',
            }}
          >
            <Text type="secondary" style={{ fontSize: 13 }}>
              💡 {t('onboarding.organization.tip') || '创建组织后，您可以邀请团队成员并开始协作'}
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default OnboardingOrganization;
