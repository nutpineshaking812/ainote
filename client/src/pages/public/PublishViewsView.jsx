import React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Card } from 'antd';
import PageHeader from '../../components/PageHeader';

const PublishViewsView = () => {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('publish.views')} />
      <div style={{ padding: '24px 40px' }}>
        <Card title={t('publishViews.dataViewPlaceholder')}>
          <Typography.Paragraph>{t('publishViews.description')}</Typography.Paragraph>
          <Typography.Paragraph type="secondary">
            {t('publishViews.placeholder')}
          </Typography.Paragraph>
        </Card>
      </div>
    </>
  );
};

export default PublishViewsView;
