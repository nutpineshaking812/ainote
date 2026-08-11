import React, { useState, useEffect } from 'react';
import { Modal, Table, Tag, Space, Typography, Card, Empty, Spin } from 'antd';
import { SafetyOutlined, UserOutlined, AppstoreOutlined, GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getUserAudit, getResourceAudit } from '../api/audit';

const { Text, Title } = Typography;

const PermissionAuditModal = ({ open, onClose, userId, resourceId, title }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  useEffect(() => {
    if (open) {
      loadAudit();
    }
  }, [open, userId, resourceId]);

  const loadAudit = async () => {
    try {
      setLoading(true);
      let result = [];
      if (userId) {
        result = await getUserAudit(userId);
      } else if (resourceId) {
        result = await getResourceAudit(resourceId);
      }
      setData(result || []);
    } catch (error) {
      console.error('Failed to load audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('audit.scope') || 'Scope',
      dataIndex: 'scope',
      key: 'scope',
      render: (scope) => {
        const config = {
          GLOBAL: {
            color: 'purple',
            icon: <GlobalOutlined />,
            text: t('role.scopeGlobal') || 'Global',
          },
          APP: { color: 'cyan', icon: <AppstoreOutlined />, text: t('role.scopeApp') || 'App' },
          RESOURCE: {
            color: 'orange',
            icon: <SafetyOutlined />,
            text: t('role.scopeResource') || 'Resource',
          },
        };
        const c = config[scope] || config.GLOBAL;
        return (
          <Tag color={c.color} icon={c.icon}>
            {c.text}
          </Tag>
        );
      },
    },
    {
      title: t('audit.principal') || 'Principal',
      dataIndex: 'principalType',
      key: 'principal',
      render: (type, record) => (
        <Space>
          <Tag>{type}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.principalId}
          </Text>
        </Space>
      ),
    },
    {
      title: t('audit.role') || 'Role',
      dataIndex: 'roleId',
      key: 'role',
      render: (role) => (
        <Space direction="vertical" size={0}>
          <Text strong>{role?.name || 'Unknown'}</Text>
          <Space wrap>
            {role?.permissions?.map((p) => (
              <Tag key={p} size="small">
                {p}
              </Tag>
            ))}
          </Space>
        </Space>
      ),
    },
    {
      title: t('audit.resource') || 'Resource',
      dataIndex: 'resourceId',
      key: 'resource',
      render: (resId) =>
        resId ? (
          <Text copyable ellipsis style={{ width: 100 }}>
            {resId}
          </Text>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <Modal
      title={title || t('audit.permissionTitle') || 'Permission Audit'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <Spin spinning={loading}>
        {data.length > 0 ? (
          <Table
            dataSource={data}
            columns={columns}
            rowKey={(item) => item._id || Math.random()}
            pagination={{ pageSize: 10 }}
            size="small"
          />
        ) : (
          <Empty description={t('audit.empty') || 'No permission assignments found.'} />
        )}
      </Spin>
    </Modal>
  );
};

export default PermissionAuditModal;
