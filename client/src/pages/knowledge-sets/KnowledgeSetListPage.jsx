import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Layout,
  Empty,
  Progress,
  Tooltip,
  Row,
  Col,
  Tag,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import KnowledgeSetAPI from '../../api/knowledge-sets';
import PageHeader from '../../components/PageHeader';

const { Text } = Typography;
const { Content } = Layout;

/**
 * 知识集列表页 - 高颜值网格版
 */
const KnowledgeSetListPage = () => {
  const { appId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSet, setEditingSet] = useState(null);

  useEffect(() => {
    if (appId) loadData();
  }, [appId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await KnowledgeSetAPI.getKnowledgeSets({ appId });
      setData(res.data || res);
    } catch (err) {
      message.error(t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingSet) {
        await KnowledgeSetAPI.updateKnowledgeSet({ appId, id: editingSet.id, ...values });
        message.success(t('common.updateSuccess') || '修改成功');
      } else {
        await KnowledgeSetAPI.createKnowledgeSet({ appId, ...values });
        message.success(t('common.success'));
      }
      setIsModalVisible(false);
      setEditingSet(null);
      form.resetFields();
      loadData();
    } catch (err) {
      message.error(t('common.operationFailed'));
    }
  };

  const handleDelete = async (id) => {
    try {
      await KnowledgeSetAPI.deleteKnowledgeSet({ appId, id });
      message.success(t('common.success'));
      loadData();
    } catch (err) {
      message.error(t('common.operationFailed'));
    }
  };

  return (
    <Layout style={{ height: '100vh', background: '#f5f7fa' }}>
      <PageHeader
        title={t('sidebar.knowledgeSets')}
        onBack={() => navigate(`/apps/${appId}`)}
        showUser={true}
      />

      <Content style={{ padding: '24px', overflow: 'auto' }}>
        {loading && data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <Progress percent={60} status="active" showInfo={false} style={{ width: 200, margin: '0 auto' }} />
          </div>
        ) : (
          <Row gutter={[20, 20]}>
            {data.map((record) => {
              const total = record.itemCount || 0;
              const indexed = record.indexedCount || 0;
              const percent = total > 0 ? Math.round((indexed / total) * 100) : 0;

              // Determine status tag
              let statusTag = null;
              if (total === 0) {
                statusTag = <Tag color="default" style={{ marginRight: 0, fontSize: '11px' }}>{t('knowledgeSet.status.noResources') || '无资源'}</Tag>;
              } else if (indexed === total) {
                statusTag = <Tag color="success" style={{ marginRight: 0, fontSize: '11px' }}>{t('knowledgeSet.status.synced') || '已同步'}</Tag>;
              } else {
                statusTag = <Tag color="warning" style={{ marginRight: 0, fontSize: '11px' }}>{t('knowledgeSet.status.pending') || '待同步'}</Tag>;
              }

              return (
                <Col xs={24} sm={12} md={8} lg={6} key={record.id}>
                  <Card
                    hoverable
                    style={{
                      borderRadius: '12px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                      border: '1px solid #edf2f7',
                      transition: 'all 0.3s ease',
                    }}
                    bodyStyle={{
                      padding: '20px',
                      height: '220px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                    onClick={() => navigate(`/apps/${appId}/knowledge-sets/${record.id}`)}
                  >
                    <div>
                      {/* Icon & Title & Status Tag */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <DatabaseOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                          </div>
                          <Text strong style={{ fontSize: '14px', color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {record.name}
                          </Text>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          {statusTag}
                        </div>
                      </div>

                      {/* Description */}
                      <Text
                        type="secondary"
                        style={{
                          fontSize: '12px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          height: '36px',
                          marginBottom: '16px',
                        }}
                      >
                        {record.description || '暂无描述信息'}
                      </Text>
                    </div>

                    <div>
                      {/* Progress */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8c8c8c', marginBottom: '2px' }}>
                          <span>{t('knowledgeSet.fileProgress')}</span>
                          <span>{indexed} / {total}</span>
                        </div>
                        <Progress
                          percent={percent}
                          size="small"
                          showInfo={false}
                          status={indexed === total && total > 0 ? 'success' : 'active'}
                          strokeColor={indexed === total && total > 0 ? '#52c41a' : '#1890ff'}
                          style={{ marginBottom: 0 }}
                        />
                      </div>

                      {/* Actions */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '4px',
                          borderTop: '1px solid #f0f0f0',
                          paddingTop: '8px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Tooltip title={t('common.edit') || '编辑'}>
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined style={{ color: '#595959' }} />}
                            onClick={() => {
                              setEditingSet(record);
                              form.setFieldsValue({
                                name: record.name,
                                description: record.description,
                              });
                              setIsModalVisible(true);
                            }}
                          />
                        </Tooltip>
                        <Tooltip title={t('common.delete') || '删除'}>
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => {
                              Modal.confirm({
                                title: t('knowledgeSet.deleteTitle'),
                                content: t('knowledgeSet.deleteContent'),
                                onOk: () => handleDelete(record.id),
                              });
                            }}
                          />
                        </Tooltip>
                      </div>
                    </div>
                  </Card>
                </Col>
              );
            })}

            {/* Dashed Create Card at the end */}
            <Col xs={24} sm={12} md={8} lg={6}>
              <div
                style={{
                  height: '100%',
                  minHeight: '220px',
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: '#ffffff',
                  transition: 'all 0.2s ease',
                  gap: '8px',
                }}
                onClick={() => {
                  setEditingSet(null);
                  form.resetFields();
                  setIsModalVisible(true);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#1890ff';
                  e.currentTarget.style.background = '#f0f9ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.background = '#ffffff';
                }}
              >
                <PlusOutlined style={{ fontSize: '24px', color: '#8c8c8c' }} />
                <Text style={{ fontSize: '15px', color: '#595959', fontWeight: 500 }}>
                  {t('knowledgeSet.createTitle')}
                </Text>
              </div>
            </Col>
          </Row>
        )}
      </Content>

      <Modal
        title={editingSet ? (t('knowledgeSet.editTitle') || '编辑知识库') : t('knowledgeSet.createTitle')}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingSet(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
    </Layout>
  );
};

export default KnowledgeSetListPage;
