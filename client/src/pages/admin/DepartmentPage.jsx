import React, { useState, useEffect } from 'react';
import {
  Card,
  Tree,
  Button,
  Space,
  Typography,
  message,
  Modal,
  Form,
  Input,
  Popconfirm,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  TeamOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '../../store/OrgContext';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import {
  getOrganizationDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../../api/departments';

const { Text } = Typography;
const { TextArea } = Input;

const DepartmentPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrganization } = useOrg();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (currentOrganization) {
      loadDepartments();
    }
  }, [currentOrganization]);

  const loadDepartments = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const data = await getOrganizationDepartments(currentOrganization.id);
      setDepartments(data.departments || []);
    } catch (error) {
      message.error(error.message || t('department.loadFailed') || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = (parentDept = null) => {
    setEditingDept(parentDept);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (dept) => {
    setEditingDept(dept);
    form.setFieldsValue({
      name: dept.name,
      description: dept.description,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        name: values.name,
        description: values.description,
        ...(editingDept && !editingDept.id ? { parentId: editingDept.id } : {}),
      };

      if (editingDept?.id) {
        // Update existing department
        await updateDepartment(editingDept.id, payload);
        message.success(t('department.updateSuccess') || 'Department updated');
      } else {
        // Create new department
        await createDepartment(currentOrganization.id, payload);
        message.success(t('department.createSuccess') || 'Department created');
      }

      setModalOpen(false);
      loadDepartments();
    } catch (error) {
      message.error(error.message || 'Failed to save department');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (dept) => {
    try {
      setLoading(true);
      await deleteDepartment(dept.id);
      message.success(t('department.deleteSuccess') || 'Department deleted');
      loadDepartments();
    } catch (error) {
      message.error(error.message || 'Failed to delete department');
    } finally {
      setLoading(false);
    }
  };

  const convertToTreeData = (depts) => {
    return depts.map((dept) => ({
      key: dept.id,
      title: (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 8px',
            borderRadius: 4,
          }}
        >
          <Space>
            <Text strong>{dept.name}</Text>
            {dept.description && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {dept.description}
              </Text>
            )}
          </Space>
          <Space onClick={(e) => e.stopPropagation()}>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => handleCreate(dept)}
            >
              {t('department.addChild') || 'Add'}
            </Button>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(dept)}
            />
            <Popconfirm
              title={t('department.deleteConfirm') || 'Delete this department?'}
              onConfirm={() => handleDelete(dept)}
              okText={t('common.ok') || 'Yes'}
              cancelText={t('common.cancel') || 'No'}
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </div>
      ),
      icon: dept.children?.length > 0 ? <FolderOpenOutlined /> : <FolderOutlined />,
      children: dept.children ? convertToTreeData(dept.children) : [],
    }));
  };

  if (!currentOrganization) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">No organization selected</Text>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <PageHeader
        onBack={() => navigate('/')}
        title={
          <Space>
            <TeamOutlined style={{ color: '#00b96b' }} />
            {t('department.title') || 'Department Management'}
          </Space>
        }
        subTitle={t('department.subtitle') || 'Manage organizational structure'}
        extra={[
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleCreate()}
          >
            {t('department.createRoot') || 'Create Department'}
          </Button>,
        ]}
      />

      <div style={{ padding: '0 24px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <Card loading={loading}>
          {departments.length > 0 ? (
            <Tree
              showLine
              showIcon
              defaultExpandAll
              treeData={convertToTreeData(departments)}
              style={{ background: 'transparent' }}
            />
          ) : (
            <Empty
              description={t('department.empty') || 'No departments yet'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleCreate()}>
                {t('department.createFirst') || 'Create First Department'}
              </Button>
            </Empty>
          )}
        </Card>
      </div>

      <Modal
        title={editingDept?.id ? t('department.edit') : t('department.create')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('department.name') || 'Department Name'}
            rules={[
              {
                required: true,
                message: t('department.nameRequired') || 'Please enter department name',
              },
            ]}
          >
            <Input placeholder={t('department.namePlaceholder') || 'e.g., Engineering, Sales'} />
          </Form.Item>

          <Form.Item name="description" label={t('department.description') || 'Description'}>
            <TextArea
              rows={3}
              placeholder={t('department.descPlaceholder') || 'Optional description'}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DepartmentPage;
