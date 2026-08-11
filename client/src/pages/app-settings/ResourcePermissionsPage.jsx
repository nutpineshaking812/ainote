import React from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import ResourcePermissions from './components/ResourcePermissions';

const ResourcePermissionsPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader
        title={t('appSettings.resourceShare') || '页面与资源授权'}
        description={t('appSettings.resourceShareDesc') || '针对单个表单或视图进行精细化授权。'}
      />
      <div style={{ padding: 24 }}>
        <ResourcePermissions />
      </div>
    </>
  );
};

export default ResourcePermissionsPage;
