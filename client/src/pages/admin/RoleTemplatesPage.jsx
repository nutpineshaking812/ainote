import React from 'react';
import { useTranslation } from 'react-i18next';
import { useOrg } from '../../store/OrgContext';
import RoleManagement from '../../components/RoleManagement';

const RoleTemplatesPage = () => {
  const { t } = useTranslation();
  const { currentOrganization } = useOrg();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <RoleManagement
        organizationId={currentOrganization?.id}
        forcedScope="TEMPLATE"
        title={t('role.roleTemplates') || '应用角色模版'}
      />
    </div>
  );
};

export default RoleTemplatesPage;
