import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Button,
  Table,
  Tag,
  Space,
  message,
  Input,
  Modal,
  Select,
  Empty,
  Tooltip,
} from 'antd';
import { CopyOutlined, PlusOutlined, ShareAltOutlined, QrcodeOutlined } from '@ant-design/icons';
import * as api from '../api/auth';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const InvitationManager = ({ organizations = [] }) => {
  const { t } = useTranslation();
  const [invitations, setInvitations] = useState([]);
  const [slots, setSlots] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [targetOrg, setTargetOrg] = useState(null);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const res = await api.getInvitations();
      setInvitations(res.invitations);
      setSlots(res.slots);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const handleGenerate = async () => {
    try {
      setGenerateLoading(true);
      await api.generateInvitation({
        maxUses: 1,
      });
      message.success(t('invitation.generateSuccess') || 'Invitation code generated!');
      setIsModalVisible(false);
      fetchInvitations();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to generate invitation');
    } finally {
      setGenerateLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success(t('common.copied') || 'Copied to clipboard!');
  };

  const columns = [
    {
      title: t('invitation.code') || 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code) => (
        <Space>
          <Text strong style={{ fontFamily: 'monospace' }}>{code}</Text>
          <Tooltip title={t('common.copy')}>
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(code)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: t('invitation.type') || 'Type',
      key: 'type',
      render: () => <Tag color="blue">{t('invitation.platform') || 'Platform'}</Tag>,
    },
    {
      title: t('invitation.status') || 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        // Determine the actual display status
        let displayStatus = (status || 'ACTIVE').toUpperCase();
        
        if (record.uses >= record.maxUses && displayStatus === 'ACTIVE') {
          displayStatus = 'EXPIRED';
        }

        const statusMap = {
          ACTIVE: { color: 'success', key: 'invitation.statuses.active', label: '有效' },
          EXPIRED: { color: 'default', key: 'invitation.statuses.expired', label: '已失效' },
          REVOKED: { color: 'error', key: 'invitation.statuses.revoked', label: '已撤销' },
        };

        const config = statusMap[displayStatus] || { color: 'default', label: displayStatus };
        const label = config.key ? t(config.key) : config.label;

        return <Tag color={config.color}>{label}</Tag>;
      },
    },
    {
      title: t('invitation.createdAt') || 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <Card
      bordered={false}
      title={
        <Space>
          <ShareAltOutlined style={{ color: '#00b96b' }} />
          <span>{t('invitation.title') || 'My Invitations'}</span>
        </Space>
      }
      extra={
        <Space>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('invitation.slotsRemaining') || 'Remaining'}: <Text strong>{slots}</Text>
          </Text>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            disabled={slots <= 0}
            onClick={() => setIsModalVisible(true)}
            style={{ borderRadius: 6 }}
          >
            {t('invitation.generate') || 'Generate'}
          </Button>
        </Space>
      }
      style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
    >
      <Table
        dataSource={invitations}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 5 }}
        size="middle"
        locale={{
          emptyText: (
            <Empty
              description={t('invitation.noInvitations') || 'No invitation codes yet'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
      />

      <Modal
        title={t('invitation.generateTitle') || 'New Invitation'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={handleGenerate}
        confirmLoading={generateLoading}
        okText={t('common.generate') || 'Generate'}
        centered
        width={400}
      >
        <Space direction="vertical" style={{ width: '100%', paddingTop: 16 }} size="large">
          <div style={{ textAlign: 'center' }}>
            <Title level={5}>{t('invitation.platformTitle') || 'Platform Invitation Code'}</Title>
            <Text type="secondary">
              {t('invitation.platformDesc') || 'Invite others to join the platform. Each code allows for 1 registration.'}
            </Text>
          </div>

          <div
            style={{
              background: '#f9f9f9',
              padding: '16px',
              borderRadius: 8,
              border: '1px dashed #d9d9d9',
              textAlign: 'center'
            }}
          >
             <Text strong>{t('invitation.slotsWarning') || 'Consumes 1 personal invitation slot.'}</Text>
          </div>
        </Space>
      </Modal>
    </Card>
  );
};

export default InvitationManager;
