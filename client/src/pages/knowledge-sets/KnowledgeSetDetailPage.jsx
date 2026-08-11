import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Table,
  Card,
  message,
  Popconfirm,
  Typography,
  Tooltip,
  Badge,
  Empty,
  Button,
  Space,
  Tabs,
  Input,
  List,
  Tag,
  Form,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import KnowledgeSetAPI from '../../api/knowledge-sets';
import KnowledgeResourceSelector from './components/KnowledgeResourceSelector';
import PageHeader from '../../components/PageHeader';
import { getResourceIcon } from '../../features/resource-tree/utils/resourceIcons';

const { Text } = Typography;
const { Content } = Layout;

/**
 * 知识集详情管理页
 * 复用全站统一的 PageHeader 组件
 */
const KnowledgeSetDetailPage = () => {
  const { appId, id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [knowledgeSet, setKnowledgeSet] = useState(null);
  const [items, setItems] = useState([]);
  const [isSelectorVisible, setIsSelectorVisible] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [testLoading, setTestLoading] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();

  const handleUpdate = async (values) => {
    try {
      await KnowledgeSetAPI.updateKnowledgeSet({ appId, id, ...values });
      message.success(t('common.updateSuccess') || '修改成功');
      setIsEditModalVisible(false);
      loadMetadata();
    } catch (err) {
      message.error(t('common.operationFailed'));
    }
  };

  const handleTestSearch = async (val) => {
    if (!val.trim()) {
      message.warning(t('knowledgeSet.queryRequired') || '请输入查询内容');
      return;
    }
    setTestLoading(true);
    try {
      const res = await KnowledgeSetAPI.testRetrieval({ appId, id, query: val });
      setTestResults(res.data || res);
    } catch (err) {
      message.error(t('knowledgeSet.testFailed') || '测试召回失败');
    } finally {
      setTestLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    if (!id || loading) return;
    setLoading(true);
    try {
      // 这里的并发请求已经是最小化合并了
      await Promise.all([loadMetadata(), loadItems(true)]);
    } finally {
      setLoading(false);
    }
  };

  const loadMetadata = async () => {
    try {
      const res = await KnowledgeSetAPI.getKnowledgeSet({ appId, id });
      setKnowledgeSet(res.data || res);
    } catch (err) {
      console.error('Metadata load failed', err);
    }
  };

  const loadItems = async (skipLoadingState = false) => {
    if (!skipLoadingState) setLoading(true);
    try {
      const res = await KnowledgeSetAPI.getItems({ appId, id });
      setItems(res.data || res);
    } catch (err) {
      message.error(t('common.loadFailed'));
    } finally {
      if (!skipLoadingState) setLoading(false);
    }
  };

  const handleAddResources = async (resourceIds) => {
    try {
      await KnowledgeSetAPI.addItems({ appId, id, resourceIds });
      message.success(t('common.success'));
      setIsSelectorVisible(false);
      loadItems(); // 仅刷新列表，不再请求元数据
    } catch (err) {
      message.error(t('common.operationFailed'));
    }
  };

  const handleRemoveItem = async (resourceId) => {
    try {
      await KnowledgeSetAPI.removeItem({ appId, id, resourceId });
      message.success(t('common.updateSuccess'));
      loadItems(); // 仅刷新列表，不再请求元数据
    } catch (err) {
      message.error(t('common.operationFailed'));
    }
  };

  const handleSyncItem = async (resourceId) => {
    try {
      await KnowledgeSetAPI.syncItem({ appId, id, resourceId });
      message.success(t('common.success'));
      loadItems(); // 仅刷新列表，使用增量状态更新
    } catch (err) {
      message.error(t('common.operationFailed'));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'indexing':
      case 'INDEXING':
        return <SyncOutlined spin style={{ color: '#1890ff' }} />;
      case 'FAILED':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
    }
  };

  const columns = [
    {
      title: t('knowledgeSet.name'),
      key: 'name',
      render: (_, record) => (
        <Space size={8}>
          {getResourceIcon(record.type)}
          <Text strong>{record.name || record.resourceId}</Text>
        </Space>
      ),
    },
    {
      title: t('knowledgeSet.syncStatus'),
      dataIndex: 'syncStatus',
      key: 'syncStatus',
      width: 150,
      render: (status) => {
        const text = t(`knowledgeSet.status.${status.toLowerCase()}`) || status;
        const icon = getStatusIcon(status);
        return (
          <Space size={6}>
            {icon}
            <Text style={{ fontSize: '13px' }}>{text}</Text>
          </Space>
        );
      },
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <Space size="middle">
          {(record.syncStatus === 'PENDING' || record.syncStatus === 'FAILED') && (
            <Tooltip title={t('knowledgeSet.syncNow') || '立即同步'}>
              <Button
                type="text"
                icon={<SyncOutlined />}
                onClick={() => handleSyncItem(record.resourceId)}
              />
            </Tooltip>
          )}
          <Tooltip title={t('common.delete')}>
            <Popconfirm
              title={t('knowledgeSet.removeConfirm')}
              onConfirm={() => handleRemoveItem(record.resourceId)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ height: '100vh', background: '#f5f7fa' }}>
      <PageHeader
        onBack={() => navigate(`/apps/${appId}/knowledge-sets`)}
        showUser={true}
        breadcrumb={{
          items: [
            {
              title: t('sidebar.knowledgeSets'),
              onClick: () => navigate(`/apps/${appId}/knowledge-sets`),
              className: 'cursor-pointer',
            },
            { title: knowledgeSet?.name },
          ],
        }}
        extra={[
          <Button
            key="edit"
            icon={<EditOutlined />}
            onClick={() => {
              editForm.setFieldsValue({
                name: knowledgeSet?.name,
                description: knowledgeSet?.description,
              });
              setIsEditModalVisible(true);
            }}
            style={{ marginRight: 8 }}
          >
            {t('common.edit') || '编辑'}
          </Button>,
          <Button
            key="add"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsSelectorVisible(true)}
          >
            {t('knowledgeSet.addResource')}
          </Button>,
        ]}
      />

      <Content style={{ padding: '16px', overflow: 'auto' }}>
        <Card
          bordered={false}
          bodyStyle={{ padding: '12px 16px' }}
          style={{ borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)' }}
        >
          <Tabs defaultActiveKey="1" size="small">
            <Tabs.TabPane tab={t('knowledgeSet.resourceList') || '资源列表'} key="1">
              <Table
                columns={columns}
                dataSource={items}
                rowKey="resourceId"
                loading={loading}
                pagination={false}
                size="small"
                locale={{ emptyText: <Empty description={t('common.noData')} /> }}
                style={{ marginTop: 8 }}
              />
            </Tabs.TabPane>
            <Tabs.TabPane tab={t('knowledgeSet.testRecall') || '召回测试'} key="2">
              <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size="middle">
                <Input.Search
                  placeholder={t('knowledgeSet.testSearchPlaceholder') || '输入测试查询文本...'}
                  enterButton={t('knowledgeSet.testSearchButton') || '测试召回'}
                  size="middle"
                  loading={testLoading}
                  onSearch={handleTestSearch}
                />
                
                <List
                  loading={testLoading}
                  dataSource={testResults}
                  locale={{ emptyText: <Empty description={t('knowledgeSet.noTestResults') || '输入查询内容并点击测试召回'} /> }}
                  renderItem={(item) => (
                    <Card
                      size="small"
                      style={{ marginBottom: 8, borderRadius: 6, border: '1px solid #f0f0f0' }}
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <Space>
                            {getResourceIcon(item.docType)}
                            <Text strong>{item.docName}</Text>
                            {item.header && <Tag color="blue">{item.header}</Tag>}
                          </Space>
                          <Space>
                            <Tag color="cyan">RRF Score: {item.score?.toFixed(4) || '0.0000'}</Tag>
                            {item.vectorScore !== null && item.vectorScore !== undefined && (
                              <Tag color="purple">Vector: {item.vectorScore?.toFixed(4)}</Tag>
                            )}
                            {item.contentScore !== null && item.contentScore !== undefined && item.contentScore > 0 && (
                              <Tag color="orange">Text Rank: {item.contentScore?.toFixed(4)}</Tag>
                            )}
                          </Space>
                        </div>
                      }
                    >
                      <div style={{ whiteSpace: 'pre-wrap', color: '#555', maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
                        {item.content}
                      </div>
                    </Card>
                  )}
                />
              </Space>
            </Tabs.TabPane>
          </Tabs>
        </Card>

        <KnowledgeResourceSelector
          visible={isSelectorVisible}
          appId={appId}
          excludeIds={items.map((it) => it.resourceId)}
          onCancel={() => setIsSelectorVisible(false)}
          onOk={handleAddResources}
        />

        <Modal
          title={t('knowledgeSet.editTitle') || '编辑知识库'}
          open={isEditModalVisible}
          onCancel={() => {
            setIsEditModalVisible(false);
            editForm.resetFields();
          }}
          onOk={() => editForm.submit()}
          destroyOnClose
        >
          <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
            <Form.Item
              name="name"
              label={t('knowledgeSet.name')}
              rules={[{ required: true, message: t('knowledgeSet.nameRequired') }]}
            >
              <Input placeholder={t('knowledgeSet.namePlaceholder')} />
            </Form.Item>
            <Form.Item name="description" label={t('knowledgeSet.description')}>
              <Input.TextArea placeholder={t('knowledgeSet.descPlaceholder')} rows={4} />
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default KnowledgeSetDetailPage;
