import React, {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
  useLayoutEffect,
} from 'react';
import { Table, Tag, Typography, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { getSystemSkills } from '../../../api/skills';
import { RobotOutlined, ApiOutlined, FileTextOutlined, CodeOutlined } from '@ant-design/icons';

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

const SystemSkills = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const [scrollY, setScrollY] = useState(500);
  const containerRef = useRef(null);

  const columns = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {getSkillIcon(record.type)}
          <Text strong>{text}</Text>
        </Space>
      ),
      width: '240px',
    },
    {
      title: t('common.type'),
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag>{type}</Tag>,
      width: '120px',
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      width: '40%',
      ellipsis: true,
    },
    {
      title: 'Implementation',
      dataIndex: 'implementationRef',
      key: 'ref',
      ellipsis: true,
      render: (text) => (
        <Text type="secondary" copyable>
          {text}
        </Text>
      ),
    },
  ];

  const fetchData = async (page = 1, pageSize = 20) => {
    try {
      setLoading(true);
      const res = await getSystemSkills({ page, limit: pageSize });
      setData(res.list || []);
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

export default SystemSkills;
