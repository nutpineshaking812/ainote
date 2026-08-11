import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Dropdown,
  Space,
  message,
  Typography,
  Tag,
  Divider,
  Modal,
  List,
  Radio,
} from 'antd';
import {
  LogoutOutlined,
  UserOutlined,
  GlobalOutlined,
  CheckOutlined,
  TeamOutlined,
  SwapOutlined,
  AppstoreOutlined,
  SettingOutlined,
  RightOutlined,
  ClusterOutlined,
} from '@ant-design/icons';
import OrganizationSwitchModal from './OrganizationSwitchModal';
import { useAuth } from '../store/AuthContext';
import { useOrg } from '../store/OrgContext';
import { useTranslation } from 'react-i18next';
import { usePermission } from '../hooks/usePermission';
import { PERMISSIONS } from '../constants/permissions';

const { Text, Title } = Typography;

const UserAvatarDropdown = () => {
  const { user, logout } = useAuth();
  const { currentOrganization, organizations, isPersonalMode } = useOrg();
  const [showOrgModal, setShowOrgModal] = useState(false);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'zh';

  const languages = {
    en: { name: 'English', label: 'English' },
    zh: { name: '简体中文', label: '简体中文' },
  };

  const handleMenuClick = ({ key }) => {
    if (key === 'personal-settings') {
      navigate('/profile');
    } else if (key === 'admin-console') {
      navigate('/admin/organization');
    } else if (key === 'switch-org') {
      setShowOrgModal(true);
    } else if (key === 'profile') {
      navigate('/profile');
    } else if (key === 'admin' && isAdmin) {
      window.open('/admin', '_blank');
    } else if (key === 'zh' || key === 'en') {
      i18n.changeLanguage(key);
    } else if (key === 'logout') {
      Modal.confirm({
        title: t('common.confirmLogout') || '确定要退出登录吗？',
        onOk: () => {
          logout();
          navigate('/login');
        },
      });
    }
  };

  const isOwner =
    user &&
    currentOrganization &&
    (user.id === currentOrganization.ownerId || user._id === currentOrganization.ownerId);

  const { hasOrgPermission } = usePermission();
  const canAccessAdmin =
    hasOrgPermission(PERMISSIONS.ORG_MANAGE) ||
    hasOrgPermission(PERMISSIONS.MEMBER_MANAGE) ||
    hasOrgPermission(PERMISSIONS.ROLE_MANAGE) ||
    hasOrgPermission(PERMISSIONS.DEPT_MANAGE);

  const menuItems = [
    {
      key: 'header',
      type: 'group',
      label: (
        <div style={{ padding: '8px 4px', minWidth: 220 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <Title level={4} style={{ margin: 0, fontSize: 18 }}>
              {user?.nickname || user?.username || 'User'}
            </Title>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {currentOrganization?.logo ? (
              <img
                src={currentOrganization.logo}
                alt="Logo"
                style={{ width: 16, height: 16, borderRadius: 2, objectFit: 'cover' }}
              />
            ) : (
              <AppstoreOutlined style={{ fontSize: 14, color: '#8c8c8c' }} />
            )}
            <Text type="secondary" style={{ fontSize: 13, flex: 1 }}>
              {currentOrganization?.name || 'My Organization'}
            </Text>
            {isOwner && (
              <Tag
                color="blue"
                style={{
                  margin: 0,
                  borderRadius: 2,
                  fontSize: 11,
                  background: '#f0f5ff',
                  border: 'none',
                  color: '#1890ff',
                }}
              >
                {t('userDropdown.ownerTag') || '我创建的'}
              </Tag>
            )}
          </div>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'personal-settings',
      label: t('userDropdown.personalSettings') || '个人设置',
      icon: <SettingOutlined style={{ fontSize: 16 }} />,
    },
    canAccessAdmin && {
      key: 'admin-console',
      label: t('userDropdown.adminConsole') || '管理后台',
      icon: <AppstoreOutlined style={{ fontSize: 16 }} />,
    },
    organizations.length > 0 && {
      key: 'switch-org',
      label: t('organization.switchOrganization'),
      icon: <ClusterOutlined style={{ fontSize: 16 }} />,
    },
    { type: 'divider' },
    {
      key: 'language-parent',
      label: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <span>{t('userDropdown.language') || '语言'}</span>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>
            {languages[currentLang.startsWith('en') ? 'en' : 'zh'].name}{' '}
            <RightOutlined style={{ fontSize: 10 }} />
          </span>
        </div>
      ),
      icon: <GlobalOutlined style={{ fontSize: 16 }} />,
      children: [
        {
          key: 'zh',
          label: '简体中文',
          icon: currentLang.startsWith('zh') ? (
            <CheckOutlined style={{ color: '#00b96b' }} />
          ) : null,
        },
        {
          key: 'en',
          label: 'English',
          icon: currentLang.startsWith('en') ? (
            <CheckOutlined style={{ color: '#00b96b' }} />
          ) : null,
        },
      ],
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: t('userDropdown.logout') || '退出',
      icon: <LogoutOutlined style={{ fontSize: 16 }} />,
    },
  ].filter(Boolean);

  return (
    <>
      <Dropdown
        menu={{ items: menuItems, onClick: handleMenuClick }}
        placement="bottomRight"
        trigger={['click']}
        styles={{ root: { minWidth: 240 } }}
      >
        <Avatar
          src={user?.avatar}
          style={{
            backgroundColor: '#00b96b',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0, 185, 107, 0.15)',
            border: '2px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
          }}
          className="user-avatar-hover"
        >
          {user
            ? user.nickname
              ? user.nickname.charAt(0).toUpperCase()
              : user.username.charAt(0).toUpperCase()
            : 'U'}
        </Avatar>
      </Dropdown>

      <OrganizationSwitchModal open={showOrgModal} onCancel={() => setShowOrgModal(false)} />
    </>
  );
};

export default UserAvatarDropdown;
