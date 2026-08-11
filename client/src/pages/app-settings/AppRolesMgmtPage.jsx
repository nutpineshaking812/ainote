import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import RoleManagement from '../../components/RoleManagement';
import { useOrg } from '../../store/OrgContext';

const AppRolesMgmtPage = () => {
  const { t } = useTranslation();
  const { appId } = useParams();
  const { currentOrganization } = useOrg();
  const organizationId = currentOrganization?.id || currentOrganization?._id;

  return (
    <RoleManagement
      appId={appId}
      organizationId={organizationId}
      title={t('appSettings.appRolesMgmt') || '应用角色管理'}
      description={
        t('appPermissions.roles.desc') ||
        '定义应用内的专属身份（如：财务、审核员），并为其配置操作权限。'
      }
      extraHeaderContent={
        <Tooltip title={t('appSettings.appRolesMgmtTip') || '应用专属角色仅在该应用内生效'}>
          <QuestionCircleOutlined style={{ color: '#1890ff', cursor: 'help', fontSize: 16 }} />
        </Tooltip>
      }
    />
  );
};

export default AppRolesMgmtPage;
