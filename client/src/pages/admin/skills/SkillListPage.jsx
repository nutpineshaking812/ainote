import React, { useRef, useState } from 'react';
import { Card, Tabs, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { ReloadOutlined } from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import OrganizationSkills from './OrganizationSkills';
import SystemSkills from './SystemSkills';
import McpManagementPage from './McpManagementPage';
import PackageSkills from './PackageSkills';

const SkillListPage = () => {
  const { t } = useTranslation();
  const [activeKey, setActiveKey] = useState('org');
  const orgRef = useRef(null);
  const mcpRef = useRef(null);
  const sysRef = useRef(null);
  const pkgRef = useRef(null);

  const handleRefresh = () => {
    if (activeKey === 'org' && orgRef.current) {
      orgRef.current.refresh();
    } else if (activeKey === 'mcp' && mcpRef.current) {
      mcpRef.current.refresh();
    } else if (activeKey === 'system' && sysRef.current) {
      sysRef.current.refresh();
    } else if (activeKey === 'plugin' && pkgRef.current) {
      pkgRef.current.refresh();
    }
  };

  const items = [
    {
      key: 'org',
      label: t('admin.ability.tabInternal', 'Internal Workflow Abilities'),
      children: <OrganizationSkills ref={orgRef} />,
    },
    {
      key: 'plugin',
      label: t('admin.ability.tabPlugin', 'Plugin Abilities (Package Skills)'),
      children: <PackageSkills ref={pkgRef} />,
    },
    {
      key: 'mcp',
      label: t('admin.ability.tabExternal', 'External Plugin Abilities (MCP)'),
      children: <McpManagementPage ref={mcpRef} embedded={true} />,
    },
    {
      key: 'system',
      label: t('admin.ability.tabSystem', 'System Atomic Abilities'),
      children: <SystemSkills ref={sysRef} />,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title={t('admin.ability.title', 'Ability Center (Capability Hub)')} />
      <div style={{ flexGrow: 1, height: 0, padding: 0, overflow: 'hidden' }}>
        <Card
          bordered={false}
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          bodyStyle={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >
          <Tabs
            activeKey={activeKey}
            onChange={setActiveKey}
            items={items}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            tabBarStyle={{ marginBottom: 16 }}
            tabBarExtraContent={
              <Button icon={<ReloadOutlined />} onClick={handleRefresh} type="text">
                {t('common.refresh', 'Refresh')}
              </Button>
            }
          />
        </Card>
      </div>
    </div>
  );
};

export default SkillListPage;
