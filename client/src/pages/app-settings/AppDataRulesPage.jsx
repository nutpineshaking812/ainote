import React from 'react';
import { useTranslation } from 'react-i18next';
import { Empty, Space, Typography } from 'antd';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;

const AppDataRulesPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t('appSettings.dataRules') || '数据过滤规则'} />
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical">
              <Text strong>
                {t('appPermissions.dataRulesComingSoon') || '数据过滤规则正在开发中'}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('appPermissions.dataRulesDesc') ||
                  '未来您可以在这里 define 行级过滤策略（如：仅看本人提交）。'}
              </Text>
            </Space>
          }
        />
      </div>
    </>
  );
};

export default AppDataRulesPage;
