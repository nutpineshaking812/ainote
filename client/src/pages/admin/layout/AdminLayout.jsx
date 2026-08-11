import React from 'react';
import {
  SettingOutlined,
  ClusterOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
  ShareAltOutlined,
  BlockOutlined,
  TagOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useOrg } from '../../../store/OrgContext';
import SettingsLayout from '../../../components/SettingsLayout';

/**
 * 管理后台布局
 * 使用 SettingsLayout 作为基础布局
 */
const AdminLayout = () => {
  const { t } = useTranslation();

  const { currentOrganization, organizations, isPersonalMode } = useOrg();

  const menuItems = isPersonalMode
    ? [
        {
          key: 'tools',
          label: t('admin.nav.managementTools') || '管理工具',
          type: 'group',
          children: [
            {
              key: '/admin/skills',
              icon: <ApiOutlined />,
              label: t('admin.nav.abilities', 'Ability Center'),
            },
            {
              key: '/admin/categories',
              icon: <TagOutlined />,
              label: '标签管理',
            },
          ],
        },
      ]
    : [
        {
          key: 'basic',
          label: t('admin.nav.basicInfo') || '基本信息',
          type: 'group',
          children: [
            {
              key: '/admin/enterprise',
              icon: <ClusterOutlined />,
              label: t('admin.nav.enterpriseInfo') || '企业信息',
            },
          ],
        },
        {
          key: 'address-book',
          label: t('admin.nav.addressBook') || '通讯录',
          type: 'group',
          children: [
            {
              key: '/admin/team',
              icon: <ApartmentOutlined />,
              label: t('admin.nav.internalOrg') || '内部组织',
            },
            {
              key: '/admin/invitations',
              icon: <ShareAltOutlined />,
              label: '邀请管理',
            },
          ],
        },
        {
          key: 'permission',
          label: t('admin.nav.permissionCenter') || '权限中心',
          type: 'group',
          children: [
            {
              key: '/admin/roles',
              icon: <SafetyCertificateOutlined />,
              label: t('admin.nav.admins') || '管理员角色',
            },
            {
              key: '/admin/app-role-templates',
              icon: <SafetyCertificateOutlined />,
              label: t('role.roleTemplates') || '应用角色模版',
            },
          ],
        },
        {
          key: 'tools',
          label: t('admin.nav.managementTools') || '管理工具',
          type: 'group',
          children: [
            {
              key: '/admin/ledger',
              icon: <SettingOutlined />,
              label: 'AI 消费账单',
            },
            {
              key: '/admin/widgets',
              icon: <BlockOutlined />,
              label: '挂件管理',
            },
            {
              key: '/admin/settings',
              icon: <SettingOutlined />,
              label: t('admin.nav.enterpriseSettings') || '企业设置',
            },
            {
              key: '/admin/skills',
              icon: <ApiOutlined />,
              label: t('admin.nav.abilities', 'Ability Center'),
            },
            {
              key: '/admin/categories',
              icon: <TagOutlined />,
              label: '标签管理',
            },
          ],
        },
      ];

  return (
    <SettingsLayout
      title={t('admin.title') || '管理后台'}
      titleIcon={<SettingOutlined style={{ color: '#fff', fontSize: 18 }} />}
      iconColor="#00b96b"
      menuItems={menuItems}
      backPath="/"
      defaultOpenKeys={
        isPersonalMode ? ['tools'] : ['basic', 'address-book', 'permission', 'tools']
      }
    />
  );
};

export default AdminLayout;
