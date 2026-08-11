import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Checkbox,
  message,
  Card,
  Typography,
  Divider,
  Popconfirm,
  Row,
  Col,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  GlobalOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { APP_PERMISSIONS } from '../constants/permissions';
import {
  getGlobalRoles,
  getTemplateRoles,
  getAppRoles,
  getAvailablePermissions,
  createRole,
  updateRole,
  deleteRole,
} from '../api/roles';
import PageHeader from './PageHeader';

const { Text, Title } = Typography;
const { TextArea } = Input;

const RoleManagement = ({
  organizationId,
  appId,
  forcedScope,
  onRefresh,
  title,
  description,
  extraHeaderContent,
  showPageHeader = true,
}) => {
  const { t, i18n } = useTranslation();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({ groups: [], permissions: [] });
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form] = Form.useForm();
  const scopeValue = Form.useWatch('scope', form);
  const selectedPermissions = Form.useWatch('permissions', form) || [];

  useEffect(() => {
    if (organizationId) {
      loadRoles();
      loadPermissions();
    }
  }, [organizationId, appId, forcedScope]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      let response;

      if (forcedScope === 'GLOBAL') {
        response = await getGlobalRoles();
      } else if (forcedScope === 'TEMPLATE') {
        response = await getTemplateRoles();
      } else if (appId) {
        response = await getAppRoles(appId);
      } else {
        // Fallback for general lookup
        response = await getGlobalRoles();
      }

      setRoles(response.roles || []);
    } catch (error) {
      console.error('Failed to load roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const data = await getAvailablePermissions();
      setPermissions(data);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  };

  const handleCreate = () => {
    setEditingRole(null);
    form.resetFields();

    // Determine scope based on context
    const initialScope = forcedScope || (appId ? 'APP' : 'GLOBAL');

    form.setFieldsValue({
      permissions: [],
      scope: initialScope,
      appId: appId || undefined,
    });
    setModalOpen(true);
  };

  const handleEdit = (role) => {
    setEditingRole(role);
    form.setFieldsValue({
      name: role.name,
      description: role.description,
      permissions: role.permissions || [],
      scope: role.scope || 'GLOBAL',
      appId: role.appId?._id || role.appId,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const roleId = editingRole?.id || editingRole?._id;

      if (editingRole) {
        await updateRole(roleId, values);
      } else {
        await createRole({
          ...values,
          appId: values.appId || appId, // Support explicit or prop-based appId
        });
      }

      message.success(
        editingRole
          ? t('role.updateSuccess') || 'Role updated'
          : t('role.createSuccess') || 'Role created',
      );
      setModalOpen(false);
      loadRoles();
      onRefresh?.();
    } catch (error) {
      message.error(error.response?.data?.error?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (role) => {
    try {
      setLoading(true);
      const roleId = role.id || role._id;
      await deleteRole(roleId);
      message.success(t('role.deleteSuccess') || 'Role deleted');
      loadRoles();
      onRefresh?.();
    } catch (error) {
      message.error(error.response?.data?.error?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const translatePermissionGroup = (groupKey) => {
    const group = permissions.groups?.find((g) => g.key === groupKey);
    if (group) return i18n.language === 'en' ? group.labelEn : group.label;

    const translations = {
      organization: t('permission.group.organization') || '组织管理',
      application_mgmt: t('permission.group.application_mgmt') || '应用管理',
      form_ops: t('permission.group.form_ops') || '表单权限',
      view_ops: t('permission.group.view_ops') || '视图权限',
      doc_ops: t('permission.group.doc_ops') || '笔记权限',
      app_sys: t('permission.group.app_sys') || '系统权限',
    };
    return translations[groupKey] || groupKey;
  };

  const translatePermission = (permKey) => {
    // Attempt to find the permission in any group to get its label
    for (const group of permissions.groups || []) {
      const perm = group.permissions.find((p) => p.key === permKey);
      if (perm) return i18n.language === 'en' ? perm.labelEn : perm.label;
    }

    const translations = {
      ORG_MANAGE: t('permission.ORG_MANAGE') || '管理组织设置',
      MEMBER_MANAGE: t('permission.MEMBER_MANAGE') || '管理成员',
      ROLE_MANAGE: t('permission.ROLE_MANAGE') || '管理角色',
      DEPT_MANAGE: t('permission.DEPT_MANAGE') || '管理部门',
      APP_CREATE: t('permission.APP_CREATE') || '创建应用',
      APP_DELETE: t('permission.APP_DELETE') || '删除应用',

      'form:design': t('permission.FORM_DESIGN') || '设计表单',
      'form:view': t('permission.FORM_VIEW') || '查看数据',
      'form:fill': t('permission.FORM_FILL') || '提交数据',
      'form:export': t('permission.FORM_EXPORT') || '导出数据',

      'view:design': t('permission.VIEW_DESIGN') || '设计视图',
      'view:view': t('permission.VIEW_VIEW') || '查看视图',

      'doc:manage': t('permission.DOC_MANAGE') || '管理笔记',

      'app:manage': t('permission.APP_MANAGE') || '超级管理',
      'app:view': t('permission.APP_VIEW') || '基础访问',
    };
    return translations[permKey] || permKey;
  };

  const columns = [
    {
      title: t('role.name') || 'Role Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <Text strong>{i18n.language === 'en' && record.nameEn ? record.nameEn : name}</Text>
          {record.isSystem && (
            <Tag color="gold" icon={<LockOutlined />}>
              {t('role.system') || 'System'}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('role.scope') || 'Scope',
      dataIndex: 'scope',
      key: 'scope',
      render: (scope) => {
        if (scope === 'APP') {
          return (
            <Tag icon={<AppstoreOutlined />} color="cyan">
              {t('role.scopeApp') || 'App'}
            </Tag>
          );
        }
        if (scope === 'TEMPLATE') {
          return (
            <Tag icon={<LockOutlined />} color="orange">
              {t('role.roleTemplates') || 'Template'}
            </Tag>
          );
        }
        return (
          <Tag icon={<GlobalOutlined />} color="purple">
            {t('role.scopeGlobal') || 'Global'}
          </Tag>
        );
      },
    },
    {
      title: t('role.description') || 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text, record) => (
        <Text type="secondary">
          {(i18n.language === 'en' && record.descriptionEn ? record.descriptionEn : text) || '-'}
        </Text>
      ),
    },
    {
      title: t('role.permissions') || 'Permissions',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (perms) => (
        <Tag color="blue">
          {perms?.length || 0} {t('role.permissionsCount') || 'permissions'}
        </Tag>
      ),
    },
    {
      title: t('common.action') || 'Action',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('common.edit') || 'Edit'}
          </Button>
          {!record.isSystem && (
            <Popconfirm
              title={t('role.deleteConfirm') || 'Delete this role?'}
              onConfirm={() => handleDeleteRole(record)}
              okText={t('common.ok')}
              cancelText={t('common.cancel')}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                {t('common.delete') || 'Delete'}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const tableTitle =
    forcedScope === 'TEMPLATE'
      ? t('role.roleTemplates')
      : forcedScope === 'GLOBAL'
        ? t('admin.nav.admins')
        : t('role.appRoles');

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={0}>
      {showPageHeader && (
        <PageHeader
          title={title || tableTitle}
          description={description}
          style={{ borderBottom: '1px solid #f0f0f0' }}
          extra={
            <Space>
              {extraHeaderContent}
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                {t('role.create') || 'Create Role'}
              </Button>
            </Space>
          }
        />
      )}
      <div style={{ padding: showPageHeader ? 24 : 0 }}>
        <Table
          columns={columns}
          dataSource={roles}
          rowKey={(record) => record.id || record._id}
          loading={loading}
          pagination={false}
        />
      </div>

      <Modal
        title={
          editingRole?.isSystem
            ? `${t('role.editSystem') || 'Edit System Role'}: ${editingRole.name}`
            : editingRole
              ? t('role.edit') || 'Edit Role'
              : t('role.create') || 'Create Role'
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={loading}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ scope: 'GLOBAL' }}
          onValuesChange={(changedValues, allValues) => {
            if (changedValues.permissions) {
              const prev = selectedPermissions;
              const curr = changedValues.permissions;
              const added = curr.filter((p) => !prev.includes(p));

              if (added.length > 0) {
                let newPerms = [...curr];
                let changed = false;

                // 1. Super Admin linkage
                if (added.includes(APP_PERMISSIONS.APP_MANAGE)) {
                  const allAppPerms = permissions.groups
                    .filter((g) => g.scope === 'APP')
                    .flatMap((g) => g.permissions.map((p) => p.key));
                  newPerms = [...new Set([...newPerms, ...allAppPerms])];
                  changed = true;
                }

                // 2. Form Design linkage
                if (added.includes(APP_PERMISSIONS.FORM_DESIGN)) {
                  const formGroup = permissions.groups.find((g) => g.key === 'form_ops');
                  if (formGroup) {
                    const formPerms = formGroup.permissions.map((p) => p.key);
                    newPerms = [...new Set([...newPerms, ...formPerms])];
                    changed = true;
                  }
                }

                // 3. View Design linkage
                if (added.includes(APP_PERMISSIONS.VIEW_DESIGN)) {
                  const viewGroup = permissions.groups.find((g) => g.key === 'view_ops');
                  if (viewGroup) {
                    const viewPerms = viewGroup.permissions.map((p) => p.key);
                    newPerms = [...new Set([...newPerms, ...viewPerms])];
                    changed = true;
                  }
                }

                if (changed) {
                  form.setFieldsValue({ permissions: newPerms });
                }
              }
            }
          }}
        >
          <Form.Item
            name="name"
            label={t('role.name') || 'Role Name'}
            rules={[
              { required: true, message: t('role.nameRequired') || 'Please enter role name' },
            ]}
            tooltip={
              editingRole?.isSystem
                ? t('role.systemRoleNameLocked') || 'System role names cannot be changed'
                : null
            }
          >
            <Input
              placeholder={t('role.namePlaceholder') || 'e.g., Project Manager'}
              disabled={editingRole?.isSystem}
            />
          </Form.Item>

          <Form.Item name="description" label={t('role.description') || 'Description'}>
            <TextArea rows={2} placeholder={t('role.descPlaceholder') || 'Optional description'} />
          </Form.Item>

          {/* Scope is hidden and determined by context (handled in handleCreate/handleEdit) */}
          <Form.Item name="scope" noStyle>
            <Input type="hidden" />
          </Form.Item>

          {/* APP selection is deprecated in this isolated view. 
              Apps now manage roles within their own context. */}

          {/* Hidden appId for App Settings context */}
          {appId && (
            <Form.Item name="appId" noStyle>
              <Input type="hidden" />
            </Form.Item>
          )}

          <Divider orientation="left">
            {t('role.selectPermissions') || 'Select Permissions'}
          </Divider>

          <Form.Item name="permissions">
            <Checkbox.Group style={{ width: '100%' }}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {permissions.groups
                  ?.filter((group) => {
                    if (!group.scope) return true;
                    if (scopeValue === 'TEMPLATE') return group.scope === 'APP';
                    return group.scope === scopeValue;
                  })
                  .map((group) => (
                    <div key={group.key} style={{ marginBottom: 16 }}>
                      <Divider orientation="left" style={{ margin: '8px 0', fontSize: 14 }}>
                        {translatePermissionGroup(group.key)}
                      </Divider>
                      <Row gutter={[0, 8]}>
                        {group.permissions.map((perm) => (
                          <Col key={perm.key} span={8}>
                            <Tooltip
                              title={
                                i18n.language === 'en'
                                  ? perm.descriptionEn || perm.description
                                  : perm.description
                              }
                            >
                              <Checkbox value={perm.key}>{translatePermission(perm.key)}</Checkbox>
                            </Tooltip>
                          </Col>
                        ))}
                      </Row>
                    </div>
                  ))}
              </Space>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default RoleManagement;
