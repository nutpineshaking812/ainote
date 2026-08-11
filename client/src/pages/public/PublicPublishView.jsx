import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Card, Space, Switch, Tabs, Tag } from 'antd';
import { useParams } from 'react-router-dom';
import FormFillLink from '../public-publish/components/FormFillLink';
import RecordShareLink from '../public-publish/components/RecordShareLink';
import PublicQueryLink from '../public-publish/components/PublicQueryLink';

// Build mock links purely on client (no persistence)
const buildLinks = (origin, formId) => {
  const base = origin.replace(/\/$/, '');
  return {
    formFill: `${base}/public/forms/${formId}`,
    singleRecordShare: `${base}/public/forms/${formId}/records/:recordId`,
    publicQuery: `${base}/public/forms/${formId}/query`,
  };
};

// Link sections split into dedicated components under ../components/publish

const PublicPublishView = () => {
  const { t } = useTranslation();
  const { formId } = useParams();
  const [isPublic, setIsPublic] = useState(false);
  const [links, setLinks] = useState({});
  const [activeSubTab, setActiveSubTab] = useState('fill');

  const togglePublic = (checked) => {
    setIsPublic(checked);
    if (checked) setLinks(buildLinks(window.location.origin, formId)); else setLinks({});
  };

  const subTabItems = [
    { key: 'fill', label: t('publicPublish.formFillLink') },
    { key: 'record', label: t('publicPublish.singleRecordShareLink') },
    { key: 'query', label: t('publicPublish.publicQueryLink') },
  ];

  const renderSubContent = () => {
    switch (activeSubTab) {
      case 'fill':
        return <FormFillLink isPublic={isPublic} link={links.formFill} />;
      case 'record':
        return <RecordShareLink isPublic={isPublic} link={links.singleRecordShare} />;
      case 'query':
        return <PublicQueryLink isPublic={isPublic} link={links.publicQuery} />;
      default:
        return null;
    }
  };

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 12 }}>{t('publicPublish.title')}</Typography.Title>
      <Space style={{ marginBottom: 16 }}>
        <Tag color="orange">{t('publicPublish.frontendMock')}</Tag>
        <Typography.Text type="secondary">{t('publicPublish.mockDescription')}</Typography.Text>
      </Space>
      <Card style={{ maxWidth: 880, marginBottom: 24 }} title={t('publicPublish.accessControl')} extra={<a href="#" onClick={(e)=>e.preventDefault()}>{t('publicPublish.help')}</a>}>
        <Space align="center" size={32}>
          <span>{t('publicPublish.publicAccess')}</span>
          <Switch checked={isPublic} onChange={togglePublic} />
          <Typography.Text type="secondary">{isPublic ? t('publicPublish.enabledTooltip') : t('publicPublish.disabledTooltip')}</Typography.Text>
        </Space>
      </Card>
      <Card style={{ maxWidth: 880 }} title={t('publicPublish.linkManagement')}>
        <Tabs activeKey={activeSubTab} onChange={setActiveSubTab} items={subTabItems} style={{ marginBottom: 16 }} />
        {renderSubContent()}
        {isPublic && activeSubTab === 'fill' && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
            {t('publicPublish.copyLinkHint')}
          </Typography.Paragraph>
        )}
      </Card>
    </div>
  );
};

export default PublicPublishView;