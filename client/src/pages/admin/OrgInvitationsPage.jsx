import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, message, Modal, Form, InputNumber, DatePicker, Popconfirm, Divider, Statistic, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, ShareAltOutlined, CopyOutlined, ReloadOutlined, UserOutlined, UserAddOutlined } from '@ant-design/icons';
import { useOrg } from '../../store/OrgContext';
import { getOrgInvitations, generateOrgInvitation, revokeOrgInvitation, getOrgQuota } from '../../api/organizations';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import BatchCreateMembersModal from '../../components/BatchCreateMembersModal';

const { Text, Title, Paragraph } = Typography;

const OrgInvitationsPage = () => {
  const { t } = useTranslation();
  const { currentOrganization } = useOrg();
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [quota, setQuota] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [generating, setGenerating] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  const loadData = async (page = 1, limit = 10) => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const invRes = await getOrgInvitations(currentOrganization.id, { page, limit });
      setInvitations(invRes.invitations);
      setPagination(invRes.pagination);
    } catch (err) {
      message.error(t('invitation.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1, pagination.limit);
  }, [currentOrganization]);

  const handleTableChange = (nav) => {
    loadData(nav.current, nav.pageSize);
  };

  const handleGenerate = async (values) => {
    try {
      setGenerating(true);
      const res = await generateOrgInvitation(currentOrganization.id, {
        maxUses: values.maxUses,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : null,
      });
      setCreatedCode(res.code);
      loadData(pagination.page, pagination.limit);
      message.success(t('invitation.generateSuccess'));
    } catch (err) {
      message.error(err.message || t('invitation.generateFailed'));
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (invitationId) => {
    try {
      await revokeOrgInvitation(currentOrganization.id, invitationId);
      message.success(t('invitation.revokeSuccess'));
      loadData(pagination.page, pagination.limit);
    } catch (err) {
      message.error(err.message || t('invitation.revokeFailed'));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success(t('common.copied') || '已复制到剪贴板');
  };

  const columns = [
    {
      title: t('invitation.code'),
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Text copyable strong style={{ color: '#00b96b', fontSize: 16 }}>{code}</Text>,
    },
    {
      title: t('invitation.status'),
      key: 'status',
      render: (_, record) => {
        const isExpired = record.expiresAt && dayjs().isAfter(dayjs(record.expiresAt));
        const isExhausted = record.uses >= record.maxUses;
        const currentStatus = (record.status || 'ACTIVE').toUpperCase();
        
        if (currentStatus === 'REVOKED') return <Tag color="default">{t('invitation.revoked')}</Tag>;
        if (isExpired || isExhausted || currentStatus === 'EXPIRED') return <Tag color="error">{t('invitation.expired')}</Tag>;
        return <Tag color="success">{t('invitation.active')}</Tag>;
      }
    },
    {
      title: t('invitation.usage'),
      key: 'usage',
      render: (_, record) => (
        <span>{record.uses} / {record.maxUses}</span>
      )
    },
    {
      title: t('invitation.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: t('invitation.expiresAt'),
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : <Text type="secondary">{t('invitation.forever')}</Text>,
    },
    {
      title: t('invitation.inviter'),
      dataIndex: 'inviter',
      key: 'inviter',
      render: (inviter) => (
        <Space>
           <UserOutlined />
           <Text>{inviter?.nickname || inviter?.username || t('invitation.system')}</Text>
        </Space>
      )
    },
    {
      title: t('common.action'),
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.status !== 'REVOKED' && (
            <Popconfirm
              title={t('invitation.revokeTitle')}
              description={t('invitation.revokeConfirm')}
              onConfirm={() => handleRevoke(record._id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button type="link" danger disabled={record.status === 'REVOKED'}>{t('invitation.revoke')}</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <>
      <PageHeader 
        title={t('invitation.management')} 
        icon={<ShareAltOutlined />}
        extra={[
          <Button key="reload" icon={<ReloadOutlined />} onClick={() => loadData(pagination.page, pagination.limit)}>{t('common.refresh')}</Button>,
          <Button 
            key="batch-add" 
            icon={<UserAddOutlined />} 
            onClick={() => setBatchModalOpen(true)}
          >
            {t('member.batchCreateMembers')}
          </Button>,
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => {
            setCreatedCode(null);
            setModalOpen(true);
            form.resetFields();
          }}>{t('invitation.generate')}</Button>
        ]}
      />
      
      <div style={{ padding: 24 }}>
        <Card 
          bordered={false}
          style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
        >
          <Table 
            columns={columns} 
            dataSource={invitations} 
            rowKey="_id" 
            loading={loading}
            scroll={{ y: 'calc(100vh - 350px)' }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: pagination.total,
              showSizeChanger: true,
            }}
            onChange={handleTableChange}
          />
        </Card>
      </div>

      <Modal
        title={t('invitation.generate')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={createdCode ? [
          <Button key="close" onClick={() => setModalOpen(false)}>{t('common.close')}</Button>
        ] : [
          <Button key="cancel" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>,
          <Button key="submit" type="primary" loading={generating} onClick={() => form.submit()}>{t('common.confirmGenerate')}</Button>
        ]}
        width={createdCode ? 400 : 500}
      >
        {!createdCode ? (
          <div style={{ paddingTop: 20 }}>
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <Text type="secondary">{t('invitation.orgSubtitle')}</Text>
            </div>
            <Form form={form} layout="vertical" onFinish={handleGenerate} initialValues={{ maxUses: 10 }}>
              <Form.Item name="maxUses" label={t('invitation.maxUses')} rules={[{ required: true }]}>
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="expiresAt" label={t('invitation.expiresAt')}>
                <DatePicker 
                  showTime 
                  style={{ width: '100%' }} 
                  placeholder={t('invitation.forever')}
                  disabledDate={(current) => current && current < dayjs().endOf('day')}
                />
              </Form.Item>
            </Form>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Title level={4}>{t('invitation.generateSuccess')}</Title>
            <div style={{ background: '#f5f5f5', padding: 24, borderRadius: 8, margin: '24px 0' }}>
              <Text style={{ fontSize: 32, fontWeight: 'bold', letterSpacing: 4, color: '#00b96b' }}>
                {createdCode}
              </Text>
              <div style={{ marginTop: 16 }}>
                <Button 
                  type="link" 
                  icon={<CopyOutlined />} 
                  onClick={() => copyToClipboard(createdCode)}
                >
                  {t('invitation.copyCode')}
                </Button>
              </div>
            </div>
            <Paragraph type="secondary">
              {t('invitation.invitationTip')}
            </Paragraph>
            <Button onClick={() => setCreatedCode(null)}>{t('invitation.continueGenerate')}</Button>
          </div>
        )}
      </Modal>

      <BatchCreateMembersModal
        open={batchModalOpen}
        onCancel={() => setBatchModalOpen(false)}
        onSuccess={() => {
          setBatchModalOpen(false);
          loadData(pagination.page, pagination.limit);
        }}
      />
    </>
  );
};

export default OrgInvitationsPage;
