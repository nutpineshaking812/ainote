import React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Card } from 'antd';
import PageHeader from '../../components/PageHeader';

const MemberPublishView = () => {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('publish.toMembers')} />
      <div style={{ padding: '24px 40px' }}>
        <Card title={t('memberPublish.internalAccessConfig')}>
          <Typography.Paragraph>{t('memberPublish.description')}</Typography.Paragraph>
          <Typography.Paragraph type="secondary">
            {t('memberPublish.placeholder')}
          </Typography.Paragraph>
        </Card>
      </div>
    </>
  );
};

export default MemberPublishView;
