import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Tag,
  Typography,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TagOutlined,
  FontSizeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  getOrgCategories,
  createOrgCategory,
  updateOrgCategory,
  deleteOrgCategory,
} from '../../api/orgCategories';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import * as AntdIcons from '@ant-design/icons';

const { Title, Text } = Typography;

const IconSelectModal = ({ open, onSelect, onCancel }) => {
  const [search, setSearch] = useState('');
  const icons = Object.keys(AntdIcons).filter(
    (name) => name.endsWith('Outlined') && name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal
      title="选择图标"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={640}
      styles={{ body: { maxHeight: '400px', overflowY: 'auto' } }}
    >
      <Input
        placeholder="搜索图标..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16 }}
        allowClear
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: 8,
        }}
      >
        {icons.map((name) => (
          <div
            key={name}
            onClick={() => onSelect(name)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 8,
              cursor: 'pointer',
              border: '1px solid #f0f0f0',
              borderRadius: 4,
              transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1890ff')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#f0f0f0')}
          >
            {React.createElement(AntdIcons[name], { style: { fontSize: 24, marginBottom: 4 } })}
            <div style={{ fontSize: 10, textAlign: 'center', color: '#8c8c8c' }}>{name}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

const CategoryMgmtPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const { t } = useTranslation();

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await getOrgCategories();
      setCategories(data);
    } catch (error) {
      message.error(error.message || '加载标签失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const showModal = (category = null) => {
    setEditingCategory(category);
    if (category) {
      form.setFieldsValue(category);
    } else {
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setEditingCategory(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingCategory) {
        await updateOrgCategory({ ...values, id: editingCategory._id });
        message.success('标签更新成功');
      } else {
        await createOrgCategory(values);
        message.success('标签创建成功');
      }
      setIsModalVisible(false);
      fetchCategories();
    } catch (error) {
      if (error.name !== 'ValidationError') {
        message.error(error.message || '操作失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteOrgCategory(id);
      message.success('标签已删除');
      fetchCategories();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const columns = [
    {
      title: '显示名称',
      dataIndex: 'label',
      key: 'label',
      render: (text, record) => {
        const Icon = AntdIcons[record.icon] || TagOutlined;
        return (
          <Space>
            <Icon style={{ fontSize: 16, color: record.color || '#1890ff' }} />
            <Tag color={record.color || 'blue'}>{text}</Tag>
            {record.scope === 'user' && (
              <Tag color="orange" size="small">
                个人
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '唯一标识 (Key)',
      dataIndex: 'key',
      key: 'key',
      render: (text) => <code style={{ color: '#eb2f96' }}>{text}</code>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '操作',
      key: 'action',
      render: (text, record) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
            disabled={record.isSystem}
          >
            编辑
          </Button>
          {!record.isSystem && (
            <Popconfirm
              title="确定要删除这个标签吗？"
              onConfirm={() => handleDelete(record._id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="text" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="标签管理"
        extra={[
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
            新建标签
          </Button>,
        ]}
        style={{ borderBottom: '1px solid #f0f0f0' }}
      />

      <div style={{ padding: '24px' }}>
        <Table
          columns={columns}
          dataSource={categories}
          rowKey="_id"
          loading={loading}
          pagination={false}
        />
      </div>

      <Modal
        title={editingCategory ? '编辑标签' : '新建标签'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        confirmLoading={submitting}
        destroyOnClose
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ color: '#1890ff', icon: 'TagOutlined' }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="label"
                label="显示名称"
                rules={[{ required: true, message: '请输入显示名称' }]}
              >
                <Input prefix={<FontSizeOutlined />} placeholder="如：周报汇报" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="key"
                label="唯一标识 (Key)"
                rules={[
                  { required: true, message: '请输入唯一标识' },
                  { pattern: /^[a-z0-9_]+$/, message: '仅支持小写字母、数字和下划线' },
                ]}
              >
                <Input
                  prefix={<TagOutlined />}
                  placeholder="如：weekly_report"
                  disabled={!!editingCategory}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="icon" label="图标">
                <Input
                  prefix={
                    form.getFieldValue('icon')
                      ? React.createElement(AntdIcons[form.getFieldValue('icon')] || TagOutlined)
                      : null
                  }
                  placeholder="点击选择图标"
                  readOnly
                  onClick={() => setIsIconModalOpen(true)}
                  style={{ cursor: 'pointer' }}
                  suffix={<SearchOutlined />}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="color" label="标签颜色">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Input
                    type="color"
                    style={{ width: '60px', padding: '2px', marginRight: '8px' }}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    选择标签的装饰演颜色
                  </Text>
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="该标签的用途说明..." rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <IconSelectModal
        open={isIconModalOpen}
        onCancel={() => setIsIconModalOpen(false)}
        onSelect={(icon) => {
          form.setFieldsValue({ icon });
          setIsIconModalOpen(false);
        }}
      />
    </>
  );
};

export default CategoryMgmtPage;
