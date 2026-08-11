import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Steps, Typography, Alert, message, Space, Card } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  AppstoreOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/AuthContext';
import { useOrg } from '../store/OrgContext';
import * as api from '../api/auth';
import './Auth.css';

const { Title, Text } = Typography;

const RegisterPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const { initializeOrganizations } = useOrg();
  const [currentStep, setCurrentStep] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [invitationInfo, setInvitationInfo] = useState(null);
  const [formData, setFormData] = useState({});


  const [form] = Form.useForm();

  // All users have the same 3-step registration flow
  const steps = [
    {
      title: t('register.step0Title') || '邀请码',
      icon: <RocketOutlined />,
    },
    {
      title: t('register.step1Title') || '账号',
      icon: <MailOutlined />,
    },
    {
      title: t('register.step2Title') || '资料',
      icon: <UserOutlined />,
    },
  ];

  // Calculate if this is the last step
  const isLastStep = useMemo(() => currentStep === steps.length - 1, [currentStep, steps.length]);

  const handleNext = async () => {
    try {
      // Validate current step fields
      const fieldsToValidate = getFieldsForStep(currentStep);
      await form.validateFields(fieldsToValidate);

      // Save current step data
      const values = form.getFieldsValue(fieldsToValidate);
      const updatedFormData = { ...formData, ...values };
      setFormData(updatedFormData);
      
      // Special handling for Step 0 (Invitation)
      if (currentStep === 0) {
        setLoading(true);
        try {
          const res = await api.verifyInvitation(values.inviteCode);
          setInvitationInfo(res);
          // If code is valid, proceed
        } catch (err) {
          setError(err.response?.data?.error || 'Invalid invitation code');
          setLoading(false);
          return;
        } finally {
          setLoading(false);
        }
      }

      // Move to next step (steps array is already filtered based on invitation type)
      setCurrentStep((prev) => prev + 1);
      setError(null);
    } catch (err) {
      // Validation failed, form will show errors
    }
  };


  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      setError(null);
    }
  };

  const handleFinish = async () => {

    // Add safety check: only allow finish on the last step
    if (!isLastStep) {
      return;
    }

    try {
      let finalData;
      
      // Validate final step
      const fieldsToValidate = getFieldsForStep(currentStep);
      await form.validateFields(fieldsToValidate);
      
      // Get ALL form values (use true to get all fields including untouched ones)
      const allFormValues = form.getFieldsValue(true);
      
      // Filter out empty values from formData state
      const cleanFormData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== '' && value != null)
      );
      
      // Merge: formData first, then override with actual form values
      finalData = { ...cleanFormData, ...allFormValues };
      
      // For organization invites, use the organization name from invitation info
      if (invitationInfo?.organization) {
        finalData.organizationName = invitationInfo.organization.name;
      }

      setLoading(true);
      setError(null);
      const res = await api.register(finalData);
      message.success(t('register.success'));

      // Auto-login logic
      if (res.token && res.user) {
        // Set auth state
        setAuth(res.token, res.user);
        
        // Initialize organizations
        initializeOrganizations(res.organizations, res.currentOrganization);
        
        // Redirect based on organization status
        if (res.organizations && res.organizations.length > 0) {
          navigate('/', { replace: true });
        } else {
          navigate('/onboarding', { replace: true });
        }
      } else {
        // Fallback to login page if no token returned (legacy behavior)
        navigate('/login');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || t('register.error'));
    } finally {
      setLoading(false);
    }
  };

  const getFieldsForStep = (step) => {
    switch (step) {
      case 0:
        return ['inviteCode'];
      case 1:
        return ['email', 'password', 'confirm'];
      case 2:
        return ['username'];
      default:
        return [];
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Title level={3} style={{ marginBottom: 8 }}>
                {t('register.step0Title') || 'Limited Access'}
              </Title>
              <Text type="secondary">
                {t('register.step0Subtitle') || 'Please enter your invitation code to proceed'}
              </Text>
            </div>

            <Form.Item
              name="inviteCode"
              rules={[
                { required: true, message: t('register.inviteCodeRequired') || 'Invite code is required' },
              ]}
            >
              <Input
                prefix={<LockOutlined />}
                placeholder={t('register.inviteCode') || 'ABCD-1234'}
                size="large"
                autoFocus
                style={{ textTransform: 'uppercase' }}
              />
            </Form.Item>

            <div
              style={{
                background: '#fff7e6',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #ffd591',
              }}
            >
              <Text type="secondary" style={{ fontSize: 13 }}>
                🔒{' '}
                {t('register.inviteOnlyTip') ||
                  'We are currently in private beta. You need an invitation code from an existing user to join.'}
              </Text>
            </div>
          </Space>
        );
      case 1:
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Title level={3} style={{ marginBottom: 8 }}>
                {t('register.step1Title') || 'Create Your Account'}
              </Title>
              <Text type="secondary">
                {t('register.step1Subtitle') || 'Start your journey with a secure account'}
              </Text>
            </div>

            <Form.Item
              name="email"
              rules={[
                { type: 'email', message: t('register.emailInvalid') },
                { required: true, message: t('register.emailRequired') },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder={t('register.email')}
                size="large"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: t('register.passwordRequired') },
                { min: 6, message: t('register.passwordLength') },
              ]}
              hasFeedback
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('register.password')}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="confirm"
              dependencies={['password']}
              hasFeedback
              rules={[
                { required: true, message: t('register.confirmPasswordRequired') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('register.passwordMismatch')));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('register.confirmPassword')}
                size="large"
              />
            </Form.Item>
          </Space>
        );

      case 2:
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Title level={3} style={{ marginBottom: 8 }}>
                {t('register.step2Title') || 'Tell Us About You'}
              </Title>
              <Text type="secondary">
                {t('register.step2Subtitle') || 'How should we call you?'}
              </Text>
            </div>

            <Form.Item
              name="username"
              rules={[
                { required: true, message: t('register.usernameRequired'), whitespace: true },
                {
                  min: 3,
                  message: t('register.usernameLength') || 'Username must be at least 3 characters',
                },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t('register.username')}
                size="large"
                autoFocus
              />
            </Form.Item>

            {invitationInfo?.organization && (
              <div
                style={{
                  background: '#f6ffed',
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid #b7eb8f',
                  marginTop: 16,
                }}
              >
                <Text type="success" strong>
                  👋 {t('register.invitedToJoin') || 'You are joining'}: {invitationInfo.organization.name}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {t('register.invitedToJoinDesc') || 'Your account will be automatically added to this workspace.'}
                </Text>
              </div>
            )}
          </Space>
        );

      default:
        return null;
    }
  };


  return (
    <div className="auth-page-container">
      <Card
        className="auth-card"
        style={{
          maxWidth: 600,
          width: '100%',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="auth-header" style={{ marginBottom: 32 }}>
          <RocketOutlined className="app-logo" style={{ fontSize: '48px', color: '#1890ff' }} />
          <Title level={2} className="app-title" style={{ marginBottom: 8 }}>
            {t('register.title')}
          </Title>
          <Text type="secondary">
            {t('register.subtitle') || 'Join thousands of teams building better'}
          </Text>
        </div>

        <Steps current={currentStep} items={steps} style={{ marginBottom: 32 }} size="small" />

        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} closable />
        )}

        <Form form={form} layout="vertical" onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault(); // Always prevent default form submission
            if (isLastStep) {
              handleFinish();
            } else {
              handleNext();
            }
          }
        }}>
          {renderStepContent()}

          <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
            {currentStep > 0 && (
              <Button onClick={handlePrevious} size="large" style={{ flex: 1 }} htmlType="button">
                {t('common.previous') || 'Previous'}
              </Button>
            )}
            {!isLastStep ? (
              <Button type="primary" onClick={handleNext} size="large" htmlType="button" style={{ flex: 1 }}>
                {t('common.next') || 'Next'}
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={handleFinish}
                htmlType="button"
                loading={loading}
                size="large"
                style={{ flex: 1 }}
              >
                {t('register.registerButton') || 'Register'}
              </Button>
            )}
          </div>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          {t('register.haveAccount')} <Link to="/login">{t('register.loginNow')}</Link>
        </div>
      </Card>
      <div className="auth-footer">京ICP备2026003401号-1</div>
    </div>
  );
};

export default RegisterPage;
