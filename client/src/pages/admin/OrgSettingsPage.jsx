import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Upload, Avatar, Space, Typography } from 'antd';
import { UploadOutlined, TeamOutlined, LoadingOutlined, CameraOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '../../store/OrgContext';
import { updateOrganization } from '../../api/organizations';
import { uploadImage } from '../../api/upload';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import ImageUploadCrop from '../../components/common/ImageUploadCrop';

const { Text, Title } = Typography;
const { TextArea } = Input;

const DEFAULT_LOGO = 'https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg'; // Ant Design 默认示例图

const OrgSettingsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrganization, refreshOrganizations } = useOrg();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (currentOrganization) {
      form.setFieldsValue({
        name: currentOrganization.name,
        slogan: currentOrganization.slogan || '',
        description: currentOrganization.description || '',
      });
    }
  }, [currentOrganization, form]);

  const onLogoChange = async (url) => {
    try {
      await updateOrganization(currentOrganization.id, {
        logo: url,
      });
      message.success(t('profile.uploadSuccess'));
      await refreshOrganizations();
    } catch (error) {
      console.error('Update logo failed:', error);
      message.error(t('profile.uploadFailed'));
    }
  };

  const handleSubmit = async (values) => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      await updateOrganization(currentOrganization.id, values);
      message.success(t('organization.updateSuccess'));
      await refreshOrganizations();
    } catch (error) {
      message.error(error.message || t('organization.updateFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!currentOrganization) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">{t('organization.noOrgSelected')}</Text>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t('admin.nav.enterpriseSettings')}
        style={{ borderBottom: '1px solid #f0f0f0' }}
      />
      <div style={{ padding: 24, flex: 1 }}>
        <div>
          <Card>
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
              <Form.Item label={t('organization.logo')} extra={t('organization.logoHint')}>
                <ImageUploadCrop
                  value={currentOrganization.logo}
                  onChange={onLogoChange}
                  onStatusChange={setUploading}
                  shape="round"
                  aspect={1}
                  maxWidth={200}
                  maxHeight={200}
                  usageType="org_logo"
                  usageId={currentOrganization.id}
                >
                  <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
                    <Avatar
                      size={80}
                      icon={uploading ? <LoadingOutlined /> : <TeamOutlined />}
                      src={currentOrganization.logo || DEFAULT_LOGO}
                      style={{
                        backgroundColor: '#f0f2f5',
                        border: '2px solid #fff',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      }}
                    />
                    <Button
                      shape="circle"
                      size="small"
                      icon={<CameraOutlined />}
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      }}
                    />
                  </div>
                </ImageUploadCrop>
              </Form.Item>

              <Form.Item
                name="name"
                label={t('organization.name')}
                rules={[
                  {
                    required: true,
                    message: t('organization.nameRequired'),
                  },
                  {
                    whitespace: true,
                    message: t('organization.nameRequired'),
                  },
                ]}
              >
                <Input placeholder={t('organization.namePlaceholder')} />
              </Form.Item>

              <Form.Item name="slogan" label={t('organization.slogan')}>
                <Input placeholder={t('organization.sloganPlaceholder')} />
              </Form.Item>

              <Form.Item name="description" label={t('organization.description')}>
                <TextArea rows={4} placeholder={t('organization.descriptionPlaceholder')} />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} disabled={uploading}>
                  {t('common.save')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    </>
  );
};

export default OrgSettingsPage;
