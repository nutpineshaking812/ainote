import React from 'react';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  SafetyCertificateOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  DatabaseOutlined,
  ApiOutlined,
  TeamOutlined,
  FilterOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useOrg } from '../../store/OrgContext';
import SettingsLayout from '../../components/SettingsLayout';

/**
 * 应用设置布局
 * 使用 SettingsLayout 作为基础布局
 */
const AppSettingsLayout = () => {
  const { t } = useTranslation();
  const { appId } = useParams();
  const { isPersonalMode } = useOrg();
  const location = useLocation();
  const navigate = useNavigate();

  // Guard: Redirect if visiting permission pages in personal mode
  React.useEffect(() => {
    if (isPersonalMode && location.pathname.includes('/settings/permissions')) {
      navigate(`/apps/${appId}/settings/info`, { replace: true });
    }
  }, [isPersonalMode, location.pathname, appId, navigate]);

  const menuItems = [
    {
      key: 'settings',
      label: t('appSettings.general') || '基本设置',
      type: 'group',
      children: [
        {
          key: `/apps/${appId}/settings/info`,
          icon: <InfoCircleOutlined />,
          label: t('appSettings.appInfo') || '应用信息',
        },
      ],
    },
    !isPersonalMode && {
      key: 'permission',
      label: t('appSettings.permissionManagement') || '权限管理',
      type: 'group',
      children: [
        {
          key: `/apps/${appId}/settings/permissions/roles`,
          icon: <SafetyCertificateOutlined />,
          label: t('appSettings.appRolesMgmt') || '应用角色管理',
        },
        {
          key: `/apps/${appId}/settings/permissions/members`,
          icon: <TeamOutlined />,
          label: t('appSettings.appMemberAuth') || '应用成员授权',
        },
        {
          key: `/apps/${appId}/settings/permissions/resources`,
          icon: <DatabaseOutlined />,
          label: t('appSettings.resourceShare') || '页面与资源授权',
        },
        {
          key: `/apps/${appId}/settings/permissions/data`,
          icon: <FilterOutlined />,
          label: t('appSettings.dataRules') || '数据过滤规则',
        },
      ],
    },
    {
      key: 'ai_logic',
      label: t('appSettings.aiSection') || 'AI 设置',
      type: 'group',
      children: [
        {
          key: `/apps/${appId}/settings/ai/logic`,
          icon: <ThunderboltOutlined />,
          label: t('appSettings.aiLogic') || '核心流程',
        },
        {
          key: `/apps/${appId}/settings/ai/memory`,
          icon: <DatabaseOutlined />,
          label: t('appSettings.aiMemory') || '长期记忆',
        },
      ],
    },
    {
      key: 'developer',
      label: t('appSettings.developer') || '开发者选项',
      type: 'group',
      children: [
        {
          key: `/apps/${appId}/settings/developer`,
          icon: <ApiOutlined />,
          label: t('appSettings.apiKeys') || 'API 密钥',
        },
      ],
    },
  ].filter(Boolean);

  return (
    <SettingsLayout
      title={t('appSettings.title') || '设置'}
      titleIcon={<SettingOutlined style={{ color: '#fff', fontSize: 18 }} />}
      iconColor="#1890ff"
      menuItems={menuItems}
      backPath={`/apps/${appId}`}
      defaultOpenKeys={['settings', isPersonalMode ? 'developer' : 'permission']}
    />
  );
};

export default AppSettingsLayout;
