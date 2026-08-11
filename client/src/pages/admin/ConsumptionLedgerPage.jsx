import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Space, Tag, DatePicker, Select, Button, message } from 'antd';
import { useOrg } from '../../store/OrgContext';
import { getOrgLedger } from '../../api/ledger';
import dayjs from 'dayjs';
import { BookOutlined, ReloadOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const ConsumptionLedgerPage = () => {
  const { currentOrganization } = useOrg();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    startTime: null,
    endTime: null,
    model: null,
  });

  const loadData = async (page = 1, size = 20) => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      const res = await getOrgLedger(currentOrganization.id, {
        page,
        limit: size,
        ...filters,
      });
      setData(res.records);
      setPagination({
        current: res.pagination.page,
        pageSize: res.pagination.limit,
        total: res.pagination.total,
      });
    } catch (err) {
      message.error('加载账单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentOrganization, filters]);

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
      width: 180,
    },
    {
      title: '成员',
      dataIndex: 'userId',
      key: 'user',
      render: (u) => (
        <Space>
           <Text strong>{u?.nickname || u?.username}</Text>
           <Text type="secondary" style={{ fontSize: 12 }}>({u?.email})</Text>
        </Space>
      ),
    },
    {
      title: '应用',
      dataIndex: 'appId',
      key: 'app',
      render: (a) => a?.name || <Text type="secondary">-</Text>,
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      render: (m) => <Tag>{m}</Tag>,
    },
    {
      title: '消耗 Tokens',
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      render: (val) => (
        <Text strong style={{ color: '#1890ff' }}>{val?.toLocaleString()}</Text>
      ),
      align: 'right',
    },
    {
      title: '明细',
      key: 'detail',
      render: (_, record) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Prompt: {record.promptTokens?.toLocaleString()} / Comp: {record.completionTokens?.toLocaleString()}
        </Text>
      ),
    }
  ];

  return (
    <>
      <PageHeader 
        title="消费账单" 
        icon={<BookOutlined />}
        extra={[
          <Button key="reload" icon={<ReloadOutlined />} onClick={() => loadData()}>刷新</Button>
        ]}
      />
      <div style={{ padding: 24 }}>
        <Card>
          <Space style={{ marginBottom: 16 }}>
            <RangePicker 
              onChange={(dates) => {
                setFilters(prev => ({
                  ...prev,
                  startTime: dates ? dates[0].toISOString() : null,
                  endTime: dates ? dates[1].toISOString() : null,
                }));
              }}
            />
            <Button type="primary" onClick={() => loadData()}>查询</Button>
          </Space>
          
          <Table 
            columns={columns}
            dataSource={data}
            rowKey="_id"
            loading={loading}
            pagination={{
              ...pagination,
              onChange: (page, size) => loadData(page, size),
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
          />
        </Card>
      </div>
    </>
  );
};

export default ConsumptionLedgerPage;
