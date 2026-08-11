import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Button,
  Avatar,
  Space,
  Modal,
  Form,
  Input,
  message,
  Layout,
  Grid,
  Divider,
  Descriptions,
  Row,
  Col,
  Tag,
  Upload,
  Tabs,
  Progress,
  Statistic,
  Menu,
  Tooltip,
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  LockOutlined,
  IdcardOutlined,
  LogoutOutlined,
  KeyOutlined,
  CameraOutlined,
  LoadingOutlined,
  ShareAltOutlined,
  AccountBookOutlined,
  SafetyCertificateOutlined,
  DashboardOutlined,
  MailOutlined,
  LeftOutlined,
} from '@ant-design/icons';
import { useAuth } from '../store/AuthContext';
import { useTranslation } from 'react-i18next';
import { updateProfile, changePassword, getUserQuota } from '../api/user';
import { uploadImage } from '../api/upload';
import ImageUploadCrop from '../components/common/ImageUploadCrop';
import PageHeader from '../components/PageHeader';
import InvitationManager from '../components/InvitationManager';
import { useOrg } from '../store/OrgContext';

const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;
const { Content } = Layout;

const ProfilePage = () => {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordForm] = Form.useForm();
  const [profileForm] = Form.useForm();
  const screens = useBreakpoint();
  const [quota, setQuota] = useState(null);
  const [loadingQuota, setLoadingQuota] = useState(false);

  const fetchQuota = async () => {
    try {
      setLoadingQuota(true);
      const data = await getUserQuota();
      setQuota(data);
    } catch (error) {
      console.error('Failed to fetch quota:', error);
    } finally {
      setLoadingQuota(false);
    }
  };

  useEffect(() => {
    fetchQuota();
  }, []);

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        nickname: user.nickname,
      });
    }
  }, [user, profileForm]);

  const handleLogout = () => {
    Modal.confirm({
      title: t('userDropdown.logout'),
      content: t('common.confirmLogout'),
      okText: t('common.yes'),
      cancelText: t('common.no'),
      centered: true,
      okButtonProps: { danger: true },
      onOk: () => {
        logout();
        navigate('/login', { replace: true });
      },
    });
  };

  const showPasswordModal = () => setIsPasswordModalVisible(true);
  const showProfileModal = () => setIsProfileModalVisible(true);

  const handlePasswordCancel = () => {
    setIsPasswordModalVisible(false);
    passwordForm.resetFields();
  };

  const handleProfileCancel = () => {
    setIsProfileModalVisible(false);
  };

  const onUpdatePassword = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error(t('register.passwordMismatch'));
      return;
    }
    try {
      await changePassword({
        oldPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success(t('profile.passwordChangedSuccess'));
      setIsPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error) {
      message.error(t('profile.passwordChangeFailed'));
    }
  };

  const onUpdateProfile = async (values) => {
    try {
      const updatedUser = await updateProfile({
        nickname: values.nickname,
      });
      const newUser = { ...user, ...updatedUser };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
      message.success(t('profile.profileUpdatedSuccess'));
      setIsProfileModalVisible(false);
    } catch (error) {
      message.error(error.message || t('profile.profileUpdateFailed'));
    }
  };

  const onAvatarChange = async (url) => {
    try {
      const updatedUser = await updateProfile({ avatar: url });
      const newUser = { ...user, ...updatedUser };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
      message.success(t('profile.uploadSuccess'));
    } catch (error) {
      console.error('Update avatar failed:', error);
      message.error(t('profile.uploadFailed'));
    }
  };

  const { organizations } = useOrg();

  if (!user) return null;

  const usagePercent =
    quota?.usageLimit > 0
      ? Math.min(100, Math.round((quota.totalTokenUsage / quota.usageLimit) * 100))
      : 0;

  const menuItems = [
    { key: 'overview', icon: <DashboardOutlined />, label: t('profile.basicInformation') },
    { key: 'security', icon: <SafetyCertificateOutlined />, label: t('profile.accountSecurity') },
    {
      key: 'invitations',
      icon: <ShareAltOutlined />,
      label: t('invitation.title') || 'My Invitations',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <PageHeader title={t('profile.title')} icon={<UserOutlined />} onBack={() => navigate(-1)} />

      <Content style={{ padding: 24, height: 0, flexGrow: 1 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: '100%' }}>
          <Row gutter={24} align="stretch" style={{ height: '100%' }}>
            {/* Left Sidebar */}
            <Col xs={24} md={7} lg={6}>
              <Card
                bordered={false}
                style={{
                  borderRadius: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  marginBottom: 24,
                  height: '100%',
                }}
                bodyStyle={{
                  padding: '24px 0',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ textAlign: 'center', padding: '0 24px 24px' }}>
                  <ImageUploadCrop
                    value={user.avatar}
                    onChange={onAvatarChange}
                    onStatusChange={setUploading}
                    shape="round"
                    aspect={1}
                    maxWidth={100}
                    maxHeight={100}
                    usageType="user_avatar"
                    usageId={user.id}
                  >
                    <div
                      style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}
                    >
                      <Avatar
                        size={100}
                        src={user.avatar}
                        style={{
                          backgroundColor: !user.avatar ? '#f0f2f5' : 'transparent',
                          color: '#1890ff',
                          fontSize: 40,
                          border: '4px solid #fff',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        }}
                        icon={uploading ? <LoadingOutlined /> : <UserOutlined />}
                      >
                        {!user.avatar &&
                          !uploading &&
                          (user.nickname?.charAt(0).toUpperCase() ||
                            user.username?.charAt(0).toUpperCase())}
                      </Avatar>
                      <Button
                        shape="circle"
                        size="small"
                        icon={<CameraOutlined />}
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        }}
                      />
                    </div>
                  </ImageUploadCrop>
                  <Title level={4} style={{ marginTop: 16, marginBottom: 4 }}>
                    {user.nickname || user.username}
                  </Title>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {user.email}
                  </Text>
                  <div style={{ marginTop: 12 }}>
                    <Tag color="blue" style={{ borderRadius: 10 }}>
                      {t('profile.activeStatus')}
                    </Tag>
                  </div>
                </div>

                <Divider style={{ margin: '0' }} />

                <Menu
                  mode="vertical"
                  selectedKeys={[activeTab]}
                  onSelect={({ key }) => setActiveTab(key)}
                  items={menuItems}
                  style={{ borderRight: 'none', padding: '12px 0', flex: 1 }}
                />

                <div style={{ padding: '0 16px 16px' }}>
                  <Button
                    danger
                    block
                    icon={<LogoutOutlined />}
                    style={{ borderRadius: 8 }}
                    onClick={handleLogout}
                  >
                    {t('userDropdown.logout')}
                  </Button>
                </div>
              </Card>
            </Col>

            {/* Right Main Content */}
            <Col xs={24} md={17} lg={18}>
              <div style={{ height: '100%' }}>
                {activeTab === 'overview' && (
                  <Card
                    bordered={false}
                    style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    title={
                      <Space>
                        <IdcardOutlined style={{ color: '#1890ff' }} />
                        <span>{t('profile.basicInformation')}</span>
                      </Space>
                    }
                  >
                    <Descriptions column={screens.lg ? 2 : 1} labelStyle={{ fontWeight: 'bold' }}>
                      <Descriptions.Item label={t('profile.username')}>
                        <Text strong>{user.username}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label={t('profile.email')}>
                        <Text>{user.email}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label={t('profile.nickname')}>
                        <Space>
                          <Text>{user.nickname || t('profile.noNicknameSet')}</Text>
                          <Tooltip title={t('common.edit')}>
                            <EditOutlined
                              style={{ color: '#1890ff', cursor: 'pointer' }}
                              onClick={showProfileModal}
                            />
                          </Tooltip>
                        </Space>
                      </Descriptions.Item>
                      <Descriptions.Item label={t('profile.userId')}>
                        <Text style={{ fontSize: 12 }} copyable type="secondary">
                          {user.id || user._id}
                        </Text>
                      </Descriptions.Item>
                    </Descriptions>

                    <Divider dashed style={{ margin: '32px 0 24px' }} />

                    <Title
                      level={5}
                      style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <DashboardOutlined style={{ color: '#52c41a' }} />
                      {t('profile.aiResourceQuota')}
                    </Title>

                    <Row gutter={24}>
                      <Col span={24}>
                        <div
                          style={{
                            background: '#f8fafc',
                            padding: 20,
                            borderRadius: 8,
                            marginBottom: 24,
                          }}
                        >
                          <Row gutter={24} align="middle">
                            <Col span={8}>
                              <Statistic
                                title={t('profile.orgSharedBalance')}
                                value={quota?.orgTokenBalance || 0}
                                prefix={<AccountBookOutlined style={{ color: '#00b96b' }} />}
                                loading={loadingQuota}
                                valueStyle={{ color: '#1677ff' }}
                                groupSeparator=","
                              />
                            </Col>
                            <Col span={16}>
                              <div style={{ paddingLeft: 24, borderLeft: '1px solid #e5e7eb' }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: 8,
                                  }}
                                >
                                  <Text type="secondary">{t('profile.personalUsageProgress')}</Text>
                                  <Text strong>{usagePercent}%</Text>
                                </div>
                                <Progress
                                  percent={usagePercent}
                                  showInfo={false}
                                  status={usagePercent >= 90 ? 'exception' : 'active'}
                                  strokeColor={usagePercent >= 90 ? '#ff4d4f' : '#1890ff'}
                                />
                              </div>
                            </Col>
                          </Row>
                        </div>
                      </Col>
                      <Col xs={12} sm={12}>
                        <Statistic
                          title={t('profile.totalTokenUsage')}
                          value={quota?.totalTokenUsage || 0}
                          loading={loadingQuota}
                        />
                      </Col>
                      <Col xs={12} sm={12}>
                        <Statistic
                          title={t('profile.personalUsageLimit')}
                          value={
                            quota?.usageLimit === -1
                              ? t('profile.unlimited')
                              : quota?.usageLimit || 0
                          }
                          loading={loadingQuota}
                        />
                      </Col>
                    </Row>
                  </Card>
                )}

                {activeTab === 'security' && (
                  <Card
                    bordered={false}
                    style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    title={
                      <Space>
                        <SafetyCertificateOutlined style={{ color: '#faad14' }} />
                        <span>{t('profile.accountSecurity')}</span>
                      </Space>
                    }
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <Title level={5} style={{ margin: 0 }}>
                          {t('login.password')}
                        </Title>
                        <Text type="secondary">{t('profile.passwordDesc')}</Text>
                      </div>
                      <Button onClick={showPasswordModal} icon={<LockOutlined />}>
                        {t('profile.changePassword')}
                      </Button>
                    </div>
                    <Divider />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <Title level={5} style={{ margin: 0 }}>
                          {t('profile.twoFactorAuth')}
                        </Title>
                        <Text type="secondary">{t('profile.twoFactorDesc')}</Text>
                      </div>
                      <Button disabled>{t('common.enable')}</Button>
                    </div>
                  </Card>
                )}

                {activeTab === 'invitations' && (
                  <div style={{ height: '100%' }}>
                    <InvitationManager organizations={organizations} />
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </div>
      </Content>

      {/* Edit Profile Modal */}
      <Modal
        title={t('profile.editProfile')}
        open={isProfileModalVisible}
        onCancel={handleProfileCancel}
        onOk={() => profileForm.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        centered
        width={400}
      >
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={onUpdateProfile}
          initialValues={{ nickname: user.nickname }}
          style={{ paddingTop: 16 }}
        >
          <Form.Item
            name="nickname"
            label={t('profile.nickname')}
            rules={[{ required: true, message: t('profile.nicknameRequired') }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder={t('profile.nicknamePlaceholder')}
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        title={t('profile.changePasswordModalTitle')}
        open={isPasswordModalVisible}
        onCancel={handlePasswordCancel}
        onOk={() => passwordForm.submit()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        centered
        width={450}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={onUpdatePassword}
          style={{ paddingTop: 16 }}
        >
          <Form.Item
            name="currentPassword"
            label={t('profile.currentPassword')}
            rules={[{ required: true, message: t('profile.currentPasswordPlaceholder') }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
          <Divider style={{ margin: '12px 0 24px' }} />
          <Form.Item
            name="newPassword"
            label={t('profile.newPassword')}
            rules={[
              { required: true, message: t('profile.newPasswordRequired') },
              { min: 6, message: t('profile.passwordLength') },
            ]}
          >
            <Input.Password
              prefix={<KeyOutlined style={{ color: '#bfbfbf' }} />}
              size="large"
              style={{ borderRadius: 8 }}
              placeholder={t('profile.newPasswordPlaceholder')}
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={t('profile.confirmNewPassword')}
            dependencies={['newPassword']}
            rules={[
              { required: true, message: t('profile.confirmNewPasswordPlaceholder') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('register.passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<KeyOutlined style={{ color: '#bfbfbf' }} />}
              size="large"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default ProfilePage;
