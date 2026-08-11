import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Tabs } from 'antd';
import { useParams } from 'react-router-dom';
import FormFillLink from './components/FormFillLink';
import RecordShareLink from './components/RecordShareLink';
import PublicQueryLink from './components/PublicQueryLink';
import PageHeader from '../../components/PageHeader';

// Build links based on origin and formId
const buildLinks = (origin, formId) => {
  const base = origin.replace(/\/$/, '');
  return {
    formFill: `${base}/public/forms/${formId}/fill`,
    singleRecordShare: `${base}/public/forms/${formId}/records/:recordId`,
    publicQuery: `${base}/public/forms/${formId}/query`,
  };
};

const PublicPublishView = () => {
  const { t } = useTranslation();
  const { appId, formId } = useParams();
  const [activeSubTab, setActiveSubTab] = useState('fill');
  // Components now load their own configs; no central state needed.

  const links = buildLinks(window.location.origin, formId);

  // No centralized load/save now per request.

  const subTabItems = [
    { key: 'fill', label: t('publicPublish.formFillLink') },
    // { key: 'record', label: '单条数据分享链接' },
    { key: 'query', label: t('publicPublish.publicQueryLink') },
  ];

  const renderSubContent = () => {
    switch (activeSubTab) {
      case 'fill':
        return <FormFillLink formId={formId} link={links.formFill} />;
      case 'record':
        return <RecordShareLink formId={formId} link={links.singleRecordShare} />;
      case 'query':
        return <PublicQueryLink formId={formId} link={links.publicQuery} />;
      default:
        return null;
    }
  };

  return (
    <>
      <PageHeader title={t('publish.publicly')} />
      <div style={{ padding: '24px 40px' }}>
        <Tabs
          activeKey={activeSubTab}
          onChange={setActiveSubTab}
          items={subTabItems}
          style={{ marginBottom: 16 }}
        />
        {renderSubContent()}
      </div>
    </>
  );
};

export default PublicPublishView;
