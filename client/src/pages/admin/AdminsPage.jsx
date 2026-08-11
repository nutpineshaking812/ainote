import React from 'react';
import { useTranslation } from 'react-i18next';
import { useOrg } from '../../store/OrgContext';
import RoleManagement from '../../components/RoleManagement';

const AdminsPage = () => {
  const { t } = useTranslation();
  const { currentOrganization } = useOrg();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <RoleManagement
        organizationId={currentOrganization?.id}
        forcedScope="GLOBAL"
        title={t('admin.nav.admins') || '管理员'}
      />
    </div>
  );
};

export default AdminsPage;
