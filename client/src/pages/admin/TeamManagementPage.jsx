import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  message,
  Avatar,
  Tabs,
  Tree,
  Modal,
  Form,
  Input,
  Popconfirm,
  Empty,
  Select,
  Tooltip,
  Divider,
  Menu,
  Dropdown,
} from 'antd';
import {
  UserOutlined,
  PlusOutlined,
  TeamOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  ApartmentOutlined,
  SafetyOutlined,
  SearchOutlined,
  UserAddOutlined,
  FileTextOutlined,
  MoreOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOrg } from '../../store/OrgContext';
import { useAuth } from '../../store/AuthContext';
import { useTranslation } from 'react-i18next';
import { getOrganizationMembers, transferOwnership } from '../../api/organizations';
import { getGlobalRoles } from '../../api/roles';
import {
  getOrganizationDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../../api/departments';
import { updateMember, removeMemberFromDepartment, updateMemberQuota } from '../../api/members';
import AddDeptMembersModal from '../../components/AddDeptMembersModal';
import RoleManagement from '../../components/RoleManagement';
import PermissionAuditModal from '../../components/PermissionAuditModal';
import { findDeptInTree } from '../../utils/treeHelpers';
import PageHeader from '../../components/PageHeader';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const TeamManagementPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrganization } = useOrg();
  const { user } = useAuth();
  const isOwner =
    user?.id === currentOrganization?.ownerId || user?._id === currentOrganization?.ownerId;
  const [activeTab, setActiveTab] = useState('members');

  useEffect(() => {
    if (location.pathname === '/admin/roles') {
      setActiveTab('roles');
    } else if (location.pathname === '/admin/team') {
      setActiveTab('departments');
    }
  }, [location.pathname]);

  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === 'roles') {
      navigate('/admin/roles');
    } else if (key === 'departments' || key === 'members') {
      navigate('/admin/team');
    }
  };

  // Members state
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Departments state
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [deptForm] = Form.useForm();
  const [addDeptMembersModalOpen, setAddDeptMembersModalOpen] = useState(false);

  // Member editing state
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm] = Form.useForm();

  // Audit state
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditTargetUserId, setAuditTargetUserId] = useState(null);

  // Transfer ownership state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTargetMember, setTransferTargetMember] = useState(null);
  const [transferLoading, setTransferLoading] = useState(false);

  useEffect(() => {
    if (currentOrganization) {
      loadMembers();
      loadRoles();
      loadDepartments();
    }
  }, [currentOrganization]);

  const loadMembers = async () => {
    if (!currentOrganization) return;

    try {
      setLoadingMembers(true);
      const data = await getOrganizationMembers(currentOrganization.id);
      setMembers(data.members || []);
    } catch (error) {
      message.error(error.message || t('organization.loadMembersFailed'));
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadRoles = async () => {
    if (!currentOrganization) return;

    try {
      const data = await getGlobalRoles(currentOrganization.id);
      setRoles(data.roles || []);
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const loadDepartments = async () => {
    if (!currentOrganization) return;

    try {
      setLoadingDepts(true);
      const data = await getOrganizationDepartments(currentOrganization.id);
      setDepartments(data.departments || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
      message.error(error.message || 'Failed to load departments');
    } finally {
      setLoadingDepts(false);
    }
  };

  const handleCreateDept = (parentDept = null) => {
    setEditingDept({ isCreating: true, parent: parentDept });
    deptForm.resetFields();
    setDeptModalOpen(true);
  };

  const handleEditDept = (dept) => {
    setEditingDept({ isCreating: false, dept });
    deptForm.setFieldsValue({
      name: dept.name,
      description: dept.description,
    });
    setDeptModalOpen(true);
  };

  const handleSubmitDept = async () => {
    try {
      const values = await deptForm.validateFields();
      setLoadingDepts(true);

      const isEditing = !editingDept.isCreating;

      const payload = {
        name: values.name,
        description: values.description,
        ...(editingDept.parent ? { parentId: editingDept.parent.id } : {}),
      };

      if (isEditing) {
        await updateDepartment(editingDept.dept.id, payload);
      } else {
        await createDepartment(currentOrganization.id, payload);
      }

      message.success(isEditing ? t('department.updateSuccess') : t('department.createSuccess'));
      setDeptModalOpen(false);
      loadDepartments();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoadingDepts(false);
    }
  };

  const handleDeleteDept = async (dept) => {
    try {
      setLoadingDepts(true);
      await deleteDepartment(dept.id);
      message.success(t('department.deleteSuccess'));
      loadDepartments();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoadingDepts(false);
    }
  };

  const handleEditMember = (member) => {
    setEditingMember(member);
    memberForm.setFieldsValue({
      departmentIds: member.departments?.map((d) => d.id || d._id) || [],
      roleIds: member.roles?.map((r) => r.id || r._id) || [],
      usageLimit: member.quota?.usageLimit || -1,
    });
    setMemberModalOpen(true);
  };

  const handleSubmitMember = async () => {
    try {
      setLoadingMembers(true);
      const values = await memberForm.validateFields();

      const updateMemberPromise = updateMember(editingMember.id, values);

      // Update Quota if changed
      if (values.usageLimit !== undefined) {
        await updateMemberQuota(editingMember.id, { usageLimit: values.usageLimit });
      }

      await updateMemberPromise;

      message.success(t('organization.memberUpdateSuccess') || 'Member updated successfully');
      setMemberModalOpen(false);
      loadMembers();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferTargetMember || !currentOrganization) return;

    try {
      setTransferLoading(true);
      await transferOwnership(
        currentOrganization.id,
        transferTargetMember.user?.id ||
          transferTargetMember.user?._id ||
          transferTargetMember.userId,
      );
      message.success(t('organization.transferOwnershipSuccess'));
      setTransferModalOpen(false);
      setTransferTargetMember(null);
      loadMembers();
      // Optionally reload the whole app context if the current user just gave up ownership
      window.location.reload();
    } catch (error) {
      message.error(error.message || 'Transfer failed');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleRemoveFromDept = async (memberId, deptId) => {
    try {
      setLoadingMembers(true);
      await removeMemberFromDepartment(memberId, deptId);
      message.success(t('department.removeMemberSuccess') || 'Member removed from department');
      loadMembers();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoadingMembers(false);
    }
  };

  const getSubtreeDeptIds = (dept) => {
    let ids = [dept.id || dept._id];
    if (dept.children) {
      dept.children.forEach((child) => {
        ids = ids.concat(getSubtreeDeptIds(child));
      });
    }
    return ids;
  };

  const getDepartmentMembers = (deptId) => {
    if (!deptId) return members;

    // Find the department node first
    let targetDept = null;
    for (const d of departments) {
      targetDept = findDeptById(d, deptId);
      if (targetDept) break;
    }

    if (!targetDept) return [];

    const allIds = getSubtreeDeptIds(targetDept);
    return members.filter((member) =>
      member.departments?.some((dept) => allIds.includes(dept.id || dept._id)),
    );
  };

  const flattenDepartments = (depts, prefix = '') => {
    let result = [];
    depts.forEach((dept) => {
      const fullPath = prefix ? `${prefix} / ${dept.name}` : dept.name;
      result.push({ ...dept, fullPath });
      if (dept.children && dept.children.length > 0) {
        result = result.concat(flattenDepartments(dept.children, fullPath));
      }
    });
    return result;
  };

  const getMemberColumns = (deptIdForRemoval = null) => [
    {
      title: t('organization.member') || 'Member',
      dataIndex: 'user',
      key: 'user',
      render: (user) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#00b96b' }}>
            {user?.username?.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{user?.nickname || user?.username}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {user?.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: t('organization.roles') || 'Roles',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles) => (
        <Space wrap>
          {roles?.map((role) => (
            <Tag key={role.id || role._id} color={role.name === 'Owner' ? 'gold' : 'blue'}>
              {role.name}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('organization.department') || 'Department',
      dataIndex: 'departments',
      key: 'departments',
      render: (departments) => (
        <Space wrap>
          {departments && departments.length > 0 ? (
            departments.map((dept) => (
              <Tag key={dept.id || dept._id} color="green">
                {dept.name}
              </Tag>
            ))
          ) : (
            <Text type="secondary">{t('organization.noDepartment') || 'No Department'}</Text>
          )}
        </Space>
      ),
    },
    {
      title: t('organization.status') || 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusConfig = {
          ACTIVE: { color: 'success', text: t('organization.statusActive') || 'Active' },
          INVITED: { color: 'warning', text: t('organization.statusInvited') || 'Invited' },
          DISABLED: { color: 'default', text: t('organization.statusDisabled') || 'Disabled' },
        };
        const config = statusConfig[status] || statusConfig.ACTIVE;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: t('organization.joinedAt') || 'Joined',
      dataIndex: 'joinedAt',
      key: 'joinedAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'AI Usage',
      key: 'aiUsage',
      render: (_, record) => (
        <div>
          <Text strong>{(record.quota?.totalTokenUsage || 0).toLocaleString()}</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
            /{' '}
            {record.quota?.usageLimit === -1
              ? 'Unlimited'
              : (record.quota?.usageLimit || 0).toLocaleString()}
          </Text>
        </div>
      ),
    },
    {
      title: t('common.action') || 'Action',
      key: 'action',
      width: deptIdForRemoval ? 180 : 100,
      render: (_, record) => (
        <Space>
          {record.user?.id !== currentOrganization.ownerId &&
            record.user?._id !== currentOrganization.ownerId && (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEditMember(record)}
              >
                {t('common.edit') || 'Edit'}
              </Button>
            )}
          {record.user?.id === currentOrganization.ownerId ||
          record.user?._id === currentOrganization.ownerId ? (
            <Tag color="gold" style={{ cursor: 'default' }}>
              {t('organization.owner')}
            </Tag>
          ) : null}

          <Button
            type="link"
            size="small"
            icon={<SafetyOutlined />}
            onClick={() => {
              setAuditTargetUserId(record.user?.id || record.user?._id || record.userId);
              setAuditModalOpen(true);
            }}
          >
            {t('common.audit') || '审计'}
          </Button>

          {/* Transfer Ownership dropdown for other members if current user is owner */}
          {isOwner &&
            record.user?.id !== currentOrganization.ownerId &&
            record.user?._id !== currentOrganization.ownerId && (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'transfer',
                      label: t('organization.transferOwnership'),
                      icon: <ReloadOutlined />,
                      onClick: () => {
                        setTransferTargetMember(record);
                        setTransferModalOpen(true);
                      },
                    },
                  ],
                }}
              >
                <Button type="link" size="small" icon={<MoreOutlined />} />
              </Dropdown>
            )}

          {deptIdForRemoval && (
            <Popconfirm
              title={t('department.removeMemberConfirm') || 'Remove this member from department?'}
              onConfirm={() => handleRemoveFromDept(record.id || record._id, deptIdForRemoval)}
              okText={t('common.ok')}
              cancelText={t('common.cancel')}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                {t('common.remove') || 'Remove'}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const convertToTreeData = (depts) => {
    return depts.map((dept) => {
      const memberCount = getDepartmentMembers(dept.id).length;
      const isSelected = selectedDeptId === dept.id;

      const actionMenuItems = [
        {
          key: 'add',
          icon: <PlusOutlined />,
          label: t('department.addChild') || '添加子部门',
          onClick: () => handleCreateDept(dept),
        },
        {
          key: 'edit',
          icon: <EditOutlined />,
          label: t('department.edit') || '编辑部门',
          onClick: () => handleEditDept(dept),
        },
        {
          type: 'divider',
        },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: t('common.delete') || '删除部门',
          danger: true,
          onClick: () => {
            Modal.confirm({
              title: t('department.deleteConfirm'),
              content: t('department.deleteWarning'),
              onOk: () => handleDeleteDept(dept),
            });
          },
        },
      ];

      return {
        key: dept.id,
        title: (
          <div
            className={`dept-tree-node ${isSelected ? 'selected' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 8px',
              borderRadius: 4,
              width: '100%',
              backgroundColor: isSelected ? '#effaf5' : 'transparent',
              transition: 'all 0.3s',
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              <ApartmentOutlined
                style={{ color: '#00b96b', fontSize: 16, marginRight: 8, flexShrink: 0 }}
              />
              <Text
                style={{
                  fontSize: 14,
                  color: isSelected ? '#00b96b' : '#262626',
                  fontWeight: isSelected ? 500 : 400,
                  marginRight: 4,
                }}
                ellipsis={{ tooltip: dept.name }}
              >
                {dept.name}
              </Text>
              {memberCount > 0 && (
                <Text type="secondary" style={{ fontSize: 12, marginRight: 8, flexShrink: 0 }}>
                  ({memberCount})
                </Text>
              )}
            </div>

            <Dropdown menu={{ items: actionMenuItems }} trigger={['click']}>
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: '2px 4px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
                className="node-more-actions"
              >
                <MoreOutlined style={{ fontSize: 16, color: '#8c8c8c' }} />
              </div>
            </Dropdown>
          </div>
        ),
        children: dept.children ? convertToTreeData(dept.children) : [],
      };
    });
  };

  const findDeptById = (dept, id) => {
    if ((dept.id || dept._id) === id) return dept;
    if (dept.children) {
      for (const child of dept.children) {
        const found = findDeptById(child, id);
        if (found) return found;
      }
    }
    return null;
  };

  if (!currentOrganization) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">No organization selected</Text>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t('admin.nav.internalOrg') || '内部组织'}
        style={{ borderBottom: '1px solid #f0f0f0' }}
      />
      <div style={{ padding: 24, minHeight: '100%' }}>
        <div style={{ display: 'flex', gap: 16, minHeight: '100%' }}>
          {/* Left Panel - Department Tree */}
          <Card
            style={{
              width: 280,
              flex: '0 0 280px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderRadius: 8,
            }}
            bodyStyle={{ padding: '12px 8px' }}
            title={
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <ApartmentOutlined style={{ color: '#00b96b', fontSize: 16 }} />
                  <Text strong style={{ fontSize: 15 }}>
                    {t('department.structure') || '部门'}
                  </Text>
                </Space>
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => handleCreateDept()}
                  style={{ borderRadius: 6 }}
                >
                  {t('department.create') || '添加'}
                </Button>
              </Space>
            }
          >
            <Menu
              mode="vertical"
              selectedKeys={!selectedDeptId ? ['all'] : []}
              style={{ border: 'none', marginBottom: 8 }}
              items={[
                {
                  key: 'all',
                  icon: <TeamOutlined />,
                  label: t('organization.allMembers') || '全部成员',
                  onClick: () => setSelectedDeptId(null),
                },
                {
                  key: 'resigned',
                  icon: <UserOutlined />,
                  label: t('organization.resignedMembers') || '离职成员',
                  disabled: true,
                },
              ]}
            />
            <Divider style={{ margin: '8px 0' }} />
            {departments.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                <Tree
                  // showLine={{ showLeafIcon: false }}
                  blockNode
                  defaultExpandAll
                  selectedKeys={selectedDeptId ? [selectedDeptId] : []}
                  onSelect={(keys) => setSelectedDeptId(keys[0] || null)}
                  treeData={convertToTreeData(departments)}
                  showLine={false}
                  showIcon={false}
                  icon={null}
                  style={{
                    background: 'transparent',
                    fontSize: 14,
                    paddingInline: 0,
                  }}
                  className="custom-dept-tree"
                />
              </div>
            ) : (
              <Empty
                description={t('department.empty') || '暂无部门'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '40px 0' }}
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={() => handleCreateDept()}>
                  {t('department.createFirst') || '创建第一个部门'}
                </Button>
              </Empty>
            )}
          </Card>

          {/* Right Panel - Department Members */}
          <Card
            style={{
              flex: 1,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderRadius: 8,
            }}
            bodyStyle={{ padding: 0 }}
            title={
              <Space>
                <TeamOutlined style={{ color: '#00b96b' }} />
                <Text strong style={{ fontSize: 15 }}>
                  {selectedDeptId
                    ? flattenDepartments(departments).find((d) => d.id === selectedDeptId)?.name ||
                      t('department.members')
                    : t('organization.allMembers') || '全部成员'}
                </Text>
                <Tag
                  color="blue"
                  style={{
                    fontSize: 12,
                    borderRadius: 10,
                    padding: '2px 10px',
                  }}
                >
                  {getDepartmentMembers(selectedDeptId).length}{' '}
                  {t('organization.members') || '成员'}
                </Tag>
              </Space>
            }
            extra={
              <Space>
                {selectedDeptId && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<UserAddOutlined />}
                    onClick={() => setAddDeptMembersModalOpen(true)}
                    style={{ borderRadius: 6 }}
                  >
                    {t('department.addMembers') || '添加成员'}
                  </Button>
                )}
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={loadMembers}
                  loading={loadingMembers}
                >
                  {t('common.refresh')}
                </Button>
              </Space>
            }
          >
            {getDepartmentMembers(selectedDeptId).length > 0 ? (
              <Table
                columns={getMemberColumns(selectedDeptId)}
                dataSource={getDepartmentMembers(selectedDeptId)}
                rowKey="id"
                loading={loadingMembers}
                pagination={false}
                size="small"
              />
            ) : (
              <Empty
                description={
                  selectedDeptId
                    ? t('department.noMembers') || '该部门暂无成员'
                    : t('department.selectDeptHint') || '请从左侧选择一个部门'
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '60px 0' }}
              />
            )}
          </Card>
        </div>
      </div>

      {/* Member Edit Modal */}
      <Modal
        title={t('organization.editMember') || '编辑成员'}
        open={memberModalOpen}
        onCancel={() => setMemberModalOpen(false)}
        onOk={handleSubmitMember}
        confirmLoading={loadingMembers}
      >
        <Form form={memberForm} layout="vertical">
          <Form.Item name="departmentIds" label={t('organization.department') || '部门'}>
            <Select
              mode="multiple"
              placeholder={t('organization.selectDepartment') || '选择部门'}
              options={flattenDepartments(departments).map((dept) => ({
                value: dept.id || dept._id,
                label: dept.fullPath || dept.name,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="roleIds"
            label={t('organization.roles') || '角色'}
            rules={[
              {
                required: true,
                message: t('organization.roleRequired') || '请至少选择一个角色',
              },
            ]}
          >
            <Select
              mode="multiple"
              placeholder={t('organization.selectRole') || '选择角色'}
              options={roles.map((role) => ({
                value: role.id || role._id,
                label: role.name,
              }))}
            />
          </Form.Item>

          <Divider orientation="left" plain>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('organization.aiManagement')}
            </Text>
          </Divider>

          <Form.Item
            name="usageLimit"
            label={t('organization.usageLimit')}
            extra={t('organization.usageLimitExtra')}
          >
            <Input type="number" suffix={t('organization.tokens')} />
          </Form.Item>
        </Form>
      </Modal>

      <AddDeptMembersModal
        open={addDeptMembersModalOpen}
        onCancel={() => setAddDeptMembersModalOpen(false)}
        onSuccess={() => {
          setAddDeptMembersModalOpen(false);
          loadMembers();
        }}
        currentDept={flattenDepartments(departments).find((d) => d.id === selectedDeptId)}
        allMembers={members}
      />

      {/* Department Modal */}
      <Modal
        title={
          editingDept?.isCreating
            ? editingDept.parent
              ? `${t('department.createChild')} - ${editingDept.parent.name}`
              : t('department.create')
            : t('department.edit')
        }
        open={deptModalOpen}
        onCancel={() => setDeptModalOpen(false)}
        onOk={handleSubmitDept}
        confirmLoading={loadingDepts}
      >
        <Form form={deptForm} layout="vertical">
          <Form.Item
            name="name"
            label={t('department.name') || '部门名称'}
            rules={[{ required: true, message: t('department.nameRequired') }]}
          >
            <Input placeholder={t('department.namePlaceholder')} />
          </Form.Item>

          <Form.Item name="description" label={t('department.description') || '描述'}>
            <TextArea rows={3} placeholder={t('department.descPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <PermissionAuditModal
        open={auditModalOpen}
        onClose={() => {
          setAuditModalOpen(false);
          setAuditTargetUserId(null);
        }}
        userId={auditTargetUserId}
        title={t('audit.userTitle', {
          name: members.find((m) => (m.id || m._id) === auditTargetUserId)?.user?.nickname || '',
        })}
      />

      {/* Transfer Ownership Confirmation Modal */}
      <Modal
        title={t('organization.transferOwnershipConfirmTitle')}
        open={transferModalOpen}
        onCancel={() => {
          setTransferModalOpen(false);
          setTransferTargetMember(null);
        }}
        onOk={handleTransferOwnership}
        confirmLoading={transferLoading}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
      >
        <div style={{ padding: '16px 0' }}>
          <Paragraph>
            {t('organization.transferOwnershipWarning')}
            <Text strong style={{ marginLeft: 8 }}>
              {transferTargetMember?.user?.nickname || transferTargetMember?.user?.username}
            </Text>
          </Paragraph>
          <div
            style={{
              backgroundColor: '#fffbe6',
              border: '1px solid #ffe58f',
              padding: '12px',
              borderRadius: '4px',
              marginTop: '16px',
            }}
          >
            <Text type="warning">{t('organization.transferOwnershipNote')}</Text>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default TeamManagementPage;
