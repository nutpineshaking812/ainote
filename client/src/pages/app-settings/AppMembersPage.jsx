import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Table, Button, Space, Tag, Popconfirm, message, Select, Tooltip } from 'antd';
import {
  GlobalOutlined,
  TeamOutlined,
  ApartmentOutlined,
  UserOutlined,
  SafetyOutlined,
  DeleteOutlined,
  PlusOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  getAppPermissions,
  addAppPermission,
  removeAppPermission,
  updateAppPermission,
} from '../../api/appPermissions';
import { getOrganizationDepartments } from '../../api/departments';
import { getOrganizationMembers } from '../../api/organizations';
import { getGlobalRoles, getAppRoles } from '../../api/roles';
import { useOrg } from '../../store/OrgContext';
import PermissionAuditModal from '../../components/PermissionAuditModal';
import ResourceSelectorModal from '../../components/ResourceSelectorModal';

const AppMembersPage = () => {
  const { t } = useTranslation();
  const { appId } = useParams();
  const { currentOrganization } = useOrg();
  const organizationId = currentOrganization?.id || currentOrganization?._id;

  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]); // 组织角色
  const [departments, setDepartments] = useState([]);
  const [members, setMembers] = useState([]);
  const [appRoles, setAppRoles] = useState([]); // 应用角色
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editRoleId, setEditRoleId] = useState(null);

  // Audit state
  const [auditModalOpen, setAuditModalOpen] = useState(false);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const data = await getAppPermissions(appId);
      setPermissions(data || []);
    } catch (error) {
      message.error(error.message || t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    if (!organizationId) return;
    try {
      const [rolesData, deptsData, membersData, appRolesData] = await Promise.all([
        getGlobalRoles().catch(() => []),
        getOrganizationDepartments(organizationId).catch(() => []),
        getOrganizationMembers(organizationId).catch(() => []),
        getAppRoles(appId).catch(() => []),
      ]);
      setRoles(rolesData?.roles || (Array.isArray(rolesData) ? rolesData : []));
      setDepartments(deptsData?.departments || (Array.isArray(deptsData) ? deptsData : []));
      setMembers(membersData?.members || (Array.isArray(membersData) ? membersData : []));
      
      const appRolesList = appRolesData?.roles || (Array.isArray(appRolesData) ? appRolesData : []);
      setAppRoles(appRolesList);
    } catch (error) {
      console.error('[AppMembersPage] Failed to load options:', error);
    }
  };

  useEffect(() => {
    loadPermissions();
    loadOptions();
  }, [appId, organizationId]);

  const handleAdd = async (selectedItems, selectedRoleId) => {
    if (!selectedRoleId) {
      message.error(t('app.pleaseSelectRole') || '请选择角色');
      return;
    }

    try {
      setLoading(true);
      for (const item of selectedItems) {
        await addAppPermission(appId, {
          roleId: selectedRoleId,
          targetType: item.type,
          targetId: item.id,
        });
      }
      message.success(t('app.permissionAdded'));
      setModalVisible(false);
      loadPermissions();
    } catch (error) {
      message.error(error.message || t('common.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (permissionId) => {
    try {
      await removeAppPermission(appId, permissionId);
      message.success(t('app.permissionRemoved'));
      loadPermissions();
    } catch (error) {
      message.error(error.message || t('common.operationFailed'));
    }
  };

  const handleUpdateRole = async (permissionId, roleId) => {
    try {
      setLoading(true);
      await updateAppPermission(appId, permissionId, { roleId });
      message.success(t('common.updateSuccess'));
      setEditingId(null);
      loadPermissions();
    } catch (error) {
      message.error(error.message || t('common.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const getTargetName = (record) => {
    if (record.targetType === 'ALL') return t('app.targetType.ALL');
    if (record.targetId) {
      const target = record.targetId;
      if (record.targetType === 'USER') {
        return target.nickname || target.username || target.email;
      }
      return target.name || target._id;
    }
    return '-';
  };

  const getTargetIcon = (targetType) => {
    switch (targetType) {
      case 'ALL':
        return <GlobalOutlined />;
      case 'ROLE':
        return <TeamOutlined />;
      case 'DEPARTMENT':
        return <ApartmentOutlined />;
      case 'USER':
        return <UserOutlined />;
      default:
        return null;
    }
  };

  const columns = [
    {
      title: t('appSettings.target'),
      key: 'target',
      width: '25%',
      render: (_, record) => (
        <Space>
          {getTargetIcon(record.targetType)}
          <span style={{ fontWeight: 500 }}>{getTargetName(record)}</span>
        </Space>
      ),
    },
    {
      title: t('appSettings.targetType'),
      dataIndex: 'targetType',
      key: 'targetType',
      width: '15%',
      render: (type) => (
        <Tag color="default" style={{ borderRadius: 4 }}>
          {t(`app.targetType.${type}`)}
        </Tag>
      ),
    },
    {
      title: t('role.title') || '角色',
      key: 'role',
      width: '40%',
      render: (_, record) => {
        const isEditing = editingId === record._id;
        const currentRoleId =
          record.roleId?._id || record.roleId || record.role?._id || record.role;
        const roleName = record.roleId?.name || record.role?.name || '-';

        if (isEditing) {
          return (
            <Space>
              <Select
                value={editRoleId}
                style={{ width: 220 }}
                size="small"
                onChange={setEditRoleId}
                autoFocus
                defaultOpen
              >
                {appRoles.map((role) => (
                  <Select.Option key={role._id} value={role._id}>
                    {role.name}
                  </Select.Option>
                ))}
              </Select>
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined style={{ color: '#52c41a' }} />}
                onClick={() => handleUpdateRole(record._id, editRoleId)}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined style={{ color: '#ff4d4f' }} />}
                onClick={() => setEditingId(null)}
              />
            </Space>
          );
        }

        return (
          <Space className="role-display-group">
            <Tag color="processing" style={{ borderRadius: 4, margin: 0 }}>
              {roleName}
            </Tag>
            <Button
              type="text"
              size="small"
              className="edit-button"
              icon={<EditOutlined style={{ fontSize: 12, color: '#1890ff' }} />}
              onClick={() => {
                setEditingId(record._id);
                setEditRoleId(currentRoleId);
              }}
            />
          </Space>
        );
      },
    },
    {
      title: t('common.action'),
      key: 'action',
      width: '20%',
      align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title={t('common.audit')}>
            <Button
              type="text"
              size="small"
              icon={<SafetyOutlined />}
              onClick={() => {
                setAuditModalOpen(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title={t('app.confirmRemovePermission')}
            onConfirm={() => handleRemove(record._id)}
            okText={t('common.ok')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('appSettings.appMemberAuth') || '应用成员授权'}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            {t('app.addPermission')}
          </Button>
        }
      />
      <div style={{ padding: '24px' }}>
        <style>
          {`
            .role-display-group .edit-button {
              opacity: 0;
              transition: opacity 0.2s;
            }
            .role-display-group:hover .edit-button {
              opacity: 1;
            }
          `}
        </style>
        <Table
          dataSource={permissions}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 12, hideOnSinglePage: true }}
          size="middle"
          style={{ background: '#fff', borderRadius: 8 }}
        />
      </div>

      <ResourceSelectorModal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleAdd}
        roles={roles}
        departments={departments}
        members={members}
        appRoles={appRoles}
        mode="role"
      />

      <PermissionAuditModal
        open={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        resourceId={appId}
        title={t('audit.resourceTitle')}
      />
    </>
  );
};

export default AppMembersPage;
