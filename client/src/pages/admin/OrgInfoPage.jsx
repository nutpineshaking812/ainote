import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Avatar, Space, Typography, Button, Skeleton, Divider, Statistic, Row, Col } from 'antd';
import { ClusterOutlined, TeamOutlined, EditOutlined, UserOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '../../store/OrgContext';
import { getOrgQuota } from '../../api/organizations';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';

const { Text, Title, Paragraph } = Typography;

const DEFAULT_LOGO = 'https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg';

const OrgInfoPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrganization } = useOrg();
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState(null);

  const loadQuota = async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const res = await getOrgQuota(currentOrganization.id);
      setQuota(res);
    } catch (err) {
      console.error('Failed to load org quota', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuota();
  }, [currentOrganization]);

  if (!currentOrganization) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">{t('organization.noOrgSelected') || 'No organization selected'}</Text>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t('admin.nav.enterpriseInfo')}
        icon={<ClusterOutlined />}
        extra={[
          <Button 
            key="edit" 
            type="primary" 
            icon={<EditOutlined />} 
            onClick={() => navigate('/admin/settings')}
          >
            {t('common.edit')}
          </Button>
        ]}
      />
      
      <div style={{ padding: 24 }}>
        <Row gutter={24} style={{ display: 'flex', alignItems: 'stretch' }}>
          <Col span={16} style={{ display: 'flex' }}>
            <Card 
              title={
                <Space>
                  <InfoCircleOutlined style={{ color: '#1890ff' }} />
                  <span>{t('organization.basicInfo')}</span>
                </Space>
              }
              bordered={false}
              style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', width: '100%', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ flex: 1 }}
            >
              <Descriptions column={1} labelStyle={{ width: 120, fontWeight: 'bold' }}>
                <Descriptions.Item label={t('organization.logo')}>
                  <Avatar
                    size={64}
                    icon={<TeamOutlined />}
                    src={currentOrganization.logo || DEFAULT_LOGO}
                    style={{ backgroundColor: '#f0f2f5' }}
                  />
                </Descriptions.Item>
                <Descriptions.Item label={t('organization.name')}>
                  <Text strong style={{ fontSize: 16 }}>{currentOrganization.name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('organization.slogan')}>
                  {currentOrganization.slogan ? <Text>{currentOrganization.slogan}</Text> : <Text type="secondary" italic>{t('organization.unSet')}</Text>}
                </Descriptions.Item>
                <Descriptions.Item label={t('organization.description')}>
                  <Paragraph style={{ maxWidth: 600 }}>
                    {currentOrganization.description || <Text type="secondary" italic>{t('organization.noDescription')}</Text>}
                  </Paragraph>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          
          <Col span={8} style={{ display: 'flex' }}>
            <Card 
              title={
                <Space>
                  <UserOutlined style={{ color: '#52c41a' }} />
                  <span>{t('organization.resourceQuota')}</span>
                </Space>
              }
              bordered={false}
              style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', width: '100%', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                <Statistic 
                  title={t('organization.memberCapacity')} 
                  value={quota?.currentMemberCount || 0} 
                  suffix={`/ ${quota?.memberLimit === -1 ? t('organization.infinite') : quota?.memberLimit}`} 
                  loading={loading}
                  valueStyle={{ color: '#52c41a' }}
                />
                <Divider dashed />
                <Statistic 
                  title={t('profile.availableTokens')} 
                  value={quota?.tokenBalance || 0} 
                  loading={loading}
                  valueStyle={{ color: '#1890ff' }}
                  groupSeparator=","
                />
              </div>
              <div style={{ marginTop: 24 }}>
                <Button block onClick={() => navigate('/admin/invitations')}>{t('organization.gotoInvitations')}</Button>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </>
  );
};

export default OrgInfoPage;
