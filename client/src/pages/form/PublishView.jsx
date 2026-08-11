import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout, Menu } from 'antd';
import {
  TeamOutlined,
  GlobalOutlined,
  TableOutlined,
  ApiOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import MemberPublishView from '../public/MemberPublishView.jsx';
import PublicPublishView from '../public-publish/PublicPublishView.jsx';
import PublishViewsView from '../public/PublishViewsView.jsx';
import ExternalApiIntegration from '../public-publish/components/ExternalApiIntegration.jsx';
import { useParams } from 'react-router-dom';

import SettingsLayout from '../../components/SettingsLayout';

const renderPublishContent = (activeKey) => {
  switch (activeKey.type) {
    case 'member':
      return <MemberPublishView />;
    case 'views':
      return <PublishViewsView />;
    case 'public':
      return <PublicPublishView />;
    case 'external':
      return <ExternalApiIntegration formId={activeKey.formId} />;
    default:
      return <PublicPublishView />;
  }
};

const PublishView = () => {
  const { t } = useTranslation();
  const { formId } = useParams();
  const [active, setActive] = useState('public');
  const content = useMemo(() => renderPublishContent({ type: active, formId }), [active, formId]);

  const menuItems = [
    {
      key: 'access',
      label: '访问控制',
      type: 'group',
      children: [
        {
          key: 'member',
          icon: <TeamOutlined />,
          label: t('publish.toMembers'),
        },
        {
          key: 'public',
          icon: <GlobalOutlined />,
          label: t('publish.publicly'),
        },
      ],
    },
    {
      key: 'extensions',
      label: '进阶扩展',
      type: 'group',
      children: [
        {
          key: 'views',
          icon: <TableOutlined />,
          label: t('publish.views'),
        },
        {
          key: 'external',
          icon: <ApiOutlined />,
          label: 'API 对接',
        },
      ],
    },
  ];

  return (
    <SettingsLayout
      collapsible={false}
      showHeader={false}
      menuItems={menuItems}
      activeKey={active}
      onMenuClick={({ key }) => setActive(key)}
      useOutlet={false}
      defaultOpenKeys={['access', 'extensions']}
    >
      {content}
    </SettingsLayout>
  );
};

export default PublishView;
