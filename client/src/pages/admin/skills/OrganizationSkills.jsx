import React, {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
  useLayoutEffect,
} from 'react';
import { Table, Tag, Typography, Space, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { getOrganizationSkills } from '../../../api/skills';
import {
  detachWorkflow,
  unlinkWorkflowApp,
  toggleWorkflowStatus,
  updateWorkflow,
} from '../../../api/workflow';
import {
  RobotOutlined,
  ApiOutlined,
  FileTextOutlined,
  CodeOutlined,
  EditOutlined,
  DisconnectOutlined,
  UngroupOutlined,
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import { Popconfirm, message, Button } from 'antd';

const { Text } = Typography;

const getSkillIcon = (type) => {
  switch (type) {
    case 'WORKFLOW':
      return <ApiOutlined style={{ color: '#1890ff' }} />;
    case 'DOCUMENT':
      return <FileTextOutlined style={{ color: '#52c41a' }} />;
    case 'CODE':
      return <CodeOutlined style={{ color: '#722ed1' }} />;
    default:
      return <RobotOutlined />;
  }
};

const OrganizationSkills = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const [scrollY, setScrollY] = useState(500);
  const containerRef = useRef(null);

  const handleToggleStatus = async (checked, record) => {
    try {
      const newStatus = checked ? 'ACTIVE' : 'INACTIVE';
      await toggleWorkflowStatus(record.implementationRef, newStatus);
      message.success(t('common.success'));
      fetchData(pagination.current, pagination.pageSize);
    } catch (e) {
      message.error(t('common.error'));
    }
  };

  const handleToggleSkill = async (checked, record) => {
    try {
      await updateWorkflow(record.implementationRef, { isSkill: checked });
      message.success(t('common.success'));
      fetchData(pagination.current, pagination.pageSize);
    } catch (e) {
      console.error(e);
      message.error(t('common.error'));
    }
  };

  const columns = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        const link = record.appId
          ? `/apps/${record.appId}/workflows/${record.implementationRef}`
          : `/organization/workflows/${record.implementationRef}`;
        return (
          <Space>
            {getSkillIcon(record.type)}
            <Link to={link} state={{ backPath: location.pathname + location.search }}>
              <Text style={{ fontSize: 13, color: '#1677ff' }} strong ellipsis={true}>
                {text}
              </Text>
            </Link>
            {record.appId ? (
              <Tag color="geekblue" style={{ fontSize: '10px', lineHeight: '16px' }}>
                {t('role.scopeApp', 'App')}
              </Tag>
            ) : (
              <Tag color="purple" style={{ fontSize: '10px', lineHeight: '16px' }}>
                {t('organization.org', 'Organization')}
              </Tag>
            )}
          </Space>
        );
      },
      width: '320px',
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: (
        <Space size={4}>
          <RobotOutlined />
          {t('admin.ability.aiCapability', 'AI Capability')}
        </Space>
      ),
      key: 'isSkill',
      width: '120px',
      render: (text, record) => {
        return (
          <Switch
            checked={record.isSkill}
            onChange={(checked) => handleToggleSkill(checked, record)}
            checkedChildren={t('common.enable', 'Enable')}
            unCheckedChildren={t('common.disable', 'Disable')}
            size="small"
            style={{ backgroundColor: record.isSkill ? '#1677ff' : undefined }}
          />
        );
      },
    },
    {
      title: t('organization.status', 'Status'),
      key: 'status',
      width: '100px',
      render: (text, record) => {
        return (
          <Switch
            checked={record.status === 'ACTIVE'}
            onChange={(checked) => handleToggleStatus(checked, record)}
            checkedChildren={t('organization.statusActive', 'Active')}
            unCheckedChildren={t('organization.statusDisabled', 'Inactive')}
            size="small"
          />
        );
      },
    },
    {
      title: t('common.action', 'Action'),
      key: 'action',
      width: '20%',
      render: (text, record) => {
        return (
          <Space size={8}>
            <Popconfirm
              title={t('common.confirm')}
              description={t(
                'workflow.detach.confirm',
                'Detach this workflow? It will no longer be visible as a skill.',
              )}
              disabled={!record.appId}
              onConfirm={async () => {
                try {
                  await detachWorkflow(record.implementationRef);
                  message.success(t('common.success'));
                  fetchData(pagination.current, pagination.pageSize);
                } catch (e) {
                  message.error(t('common.error'));
                }
              }}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <Button size="small" icon={<DisconnectOutlined />} danger disabled={!record.appId}>
                {t('common.detach', 'Detach')}
              </Button>
            </Popconfirm>
            <Popconfirm
              title={t('common.confirm')}
              description={t(
                'workflow.unlink.confirm',
                'Completely unlink from App? It will become an independent Organization resource.',
              )}
              disabled={!record.appId}
              onConfirm={async () => {
                try {
                  await unlinkWorkflowApp(record.implementationRef);
                  message.success(t('common.success'));
                  fetchData(pagination.current, pagination.pageSize);
                } catch (e) {
                  message.error(t('common.error'));
                }
              }}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <Button size="small" icon={<UngroupOutlined />} disabled={!record.appId}>
                {t('common.unlink', 'Unlink App')}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const fetchData = async (page = 1, pageSize = 20) => {
    try {
      setLoading(true);
      const res = await getOrganizationSkills({ page, limit: pageSize });
      setData([...res.list]);
      setPagination({
        current: page,
        pageSize,
        total: res.total || 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: () => {
      fetchData(pagination.current, pagination.pageSize);
    },
  }));

  // Calculate table scroll height dynamically
  useLayoutEffect(() => {
    const calcHeight = () => {
      if (containerRef.current) {
        const { top } = containerRef.current.getBoundingClientRect();
        // Window Height - Top - TableHeader(~55) - Pagination(~64) - Buffer(~20)
        // Adjust buffer as needed
        const h = window.innerHeight - top - 140;
        setScrollY(h > 200 ? h : 200); // Minimum height safeguard
      }
    };

    calcHeight();
    window.addEventListener('resize', calcHeight);
    return () => window.removeEventListener('resize', calcHeight);
  }, []);

  useEffect(() => {
    fetchData(pagination.current, pagination.pageSize);
  }, []);

  const handleTableChange = (pagination) => {
    fetchData(pagination.current, pagination.pageSize);
  };

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
        }}
        onChange={handleTableChange}
        scroll={{ y: scrollY }}
        style={{ flex: 1, overflow: 'hidden' }}
      />
    </div>
  );
});

export default OrganizationSkills;
