import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert } from 'antd';
import { MailOutlined, LockOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useAuth } from '../store/AuthContext';
import { useOrg } from '../store/OrgContext';
import { useTranslation } from 'react-i18next';
import './Auth.css';

const { Title } = Typography;

const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { initializeOrganizations } = useOrg();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onFinish = async (values) => {
    setLoading(true);
    setError(null);
    try {
      const response = await login(values.email, values.password);
      
      // Initialize OrgContext with login response data (avoid redundant API call)
      if (response.organizations) {
        initializeOrganizations(
          response.organizations,
          response.currentOrganization,
          response.permissions
        );
      }
      
      // Redirect based on organization status
      const hasOrganization = response.organizations && response.organizations.length > 0;
      if (hasOrganization) {
        navigate('/'); // Has organization, go to dashboard
      } else {
        navigate('/onboarding'); // No organization, go to onboarding
      }
    } catch (err) {
      setError(err.message || t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <AppstoreOutlined className="app-logo" style={{ fontSize: '48px', color: '#1890ff' }} />
          <Title level={2} className="app-title">
            {t('login.title')}
          </Title>
        </div>
        <Alert
          type="info"
          message={t('login.betaNotice')}
          description={t('login.betaDescription')}
          style={{ marginBottom: 24 }}
          showIcon
        />
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}
        <Form name="login" onFinish={onFinish} size="large">
          <Form.Item
            name="email"
            rules={[
              { type: 'email', message: t('login.emailInvalid') },
              { required: true, message: t('login.emailRequired') },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder={t('login.email')} />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: t('login.passwordRequired') }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder={t('login.password')} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
              {t('login.loginButton')}
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            {t('login.noAccount')} <Link to="/register">{t('login.registerNow')}</Link>
          </div>
        </Form>
      </div>
      <div className="auth-footer">京ICP备2026003401号-1</div>
    </div>
  );
};

export default LoginPage;

