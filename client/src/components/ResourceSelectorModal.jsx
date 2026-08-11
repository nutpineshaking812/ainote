import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Table, Input, Tag, Space, Avatar, Typography, Badge, Select } from 'antd';
import { SearchOutlined, UserOutlined, TeamOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const ResourceSelectorModal = ({
  open,
  onCancel,
  onOk,
  roles = [],
  departments = [],
  members = [],
  permissionType,
  appRoles = [], // 应用角色列表
  mode = 'permission', // 'permission' | 'role'
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('members');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedAppRole, setSelectedAppRole] = useState(null); // 选中的应用角色

  // Reset selections and tab when modal opens
  useEffect(() => {
    if (open) {
      setSelectedMembers([]);
      setSelectedDepartments([]);
      setSelectedRoles([]);
      setSearchText('');
      setActiveTab('members');
    }
  }, [open]);

  // Initialize selectedAppRole separately — depends on appRoles but must NOT reset activeTab
  useEffect(() => {
    if (open) {
      setSelectedAppRole(
        mode === 'role' && appRoles.length > 0 ? appRoles[0]._id || appRoles[0].id : null,
      );
    }
  }, [open, mode, appRoles]);

  const handleOk = () => {
    const results = [];
    selectedMembers.forEach((id) => results.push({ type: 'USER', id }));
    selectedDepartments.forEach((id) => results.push({ type: 'DEPARTMENT', id }));
    selectedRoles.forEach((id) => results.push({ type: 'ROLE', id }));

    // 如果是角色模式，返回选中的角色ID
    if (mode === 'role') {
      onOk(results, selectedAppRole);
    } else {
      onOk(results);
    }
  };

  const getFilteredMembers = () => {
    if (!searchText) return members;
    const lower = searchText.toLowerCase();
    return members.filter((m) => {
      const user = m.user || m; // Handle structure
      return (
        (user.nickname || '').toLowerCase().includes(lower) ||
        (user.username || '').toLowerCase().includes(lower) ||
        (user.email || '').toLowerCase().includes(lower)
      );
    });
  };

  const getFilteredDepartments = () => {
    if (!searchText) return departments;
    const lower = searchText.toLowerCase();
    return departments.filter((d) => (d.name || '').toLowerCase().includes(lower));
  };

  const getFilteredRoles = () => {
    if (!searchText) return roles;
    const lower = searchText.toLowerCase();
    return roles.filter((r) => (r.name || '').toLowerCase().includes(lower));
  };

  const memberColumns = [
    {
      title: t('organization.member') || 'Member',
      dataIndex: 'user',
      key: 'user',
      render: (user, record) => {
        // Handle different data structures if necessary
        const u = record.user || record;
        return (
          <Space>
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }}>
              {u?.nickname?.charAt(0).toUpperCase() || u?.username?.charAt(0).toUpperCase()}
            </Avatar>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text strong>{u?.nickname || u?.username}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {u?.email}
              </Text>
            </div>
          </Space>
        );
      },
    },
  ];

  const deptColumns = [
    {
      title: t('organization.department') || 'Department',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <Space>
          <ApartmentOutlined />
          {name}
        </Space>
      ),
    },
  ];

  const roleColumns = [
    {
      title: '角色',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <Space>
          <TeamOutlined />
          {name}
        </Space>
      ),
    },
  ];

  const renderTabContent = (dataSource, columns, selectedKeys, setSelectedKeys, rowKey) => (
    <>
      <Input
        placeholder={t('common.search') || 'Search...'}
        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: 12 }}
        allowClear
      />
      <Table
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: setSelectedKeys,
        }}
        columns={columns}
        dataSource={dataSource}
        rowKey={rowKey}
        pagination={{ pageSize: 8, size: 'small' }}
        size="small"
        scroll={{ y: 300 }}
      />
    </>
  );

  const totalSelected = selectedMembers.length + selectedDepartments.length + selectedRoles.length;

  const items = [
    {
      key: 'members',
      label: (
        <span>
          <UserOutlined /> {t('organization.members') || 'Members'}{' '}
          {selectedMembers.length > 0 && <Badge count={selectedMembers.length} size="small" />}
        </span>
      ),
      children: renderTabContent(
        getFilteredMembers(),
        memberColumns,
        selectedMembers,
        setSelectedMembers,
        (r) => (r.user ? r.user._id || r.user.id : r._id || r.id),
      ),
    },
    {
      key: 'departments',
      label: (
        <span>
          <ApartmentOutlined /> {t('organization.departments') || 'Departments'}{' '}
          {selectedDepartments.length > 0 && (
            <Badge count={selectedDepartments.length} size="small" />
          )}
        </span>
      ),
      children: renderTabContent(
        getFilteredDepartments(),
        deptColumns,
        selectedDepartments,
        setSelectedDepartments,
        (r) => r._id || r.id,
      ),
    },
    {
      key: 'roles',
      label: (
        <span>
          <TeamOutlined /> {t('organization.roles') || 'Roles'}{' '}
          {selectedRoles.length > 0 && <Badge count={selectedRoles.length} size="small" />}
        </span>
      ),
      children: renderTabContent(
        getFilteredRoles(),
        roleColumns,
        selectedRoles,
        setSelectedRoles,
        (r) => r._id || r.id,
      ),
    },
  ];

  const modalTitle =
    mode === 'role'
      ? t('app.addPermission')
      : `${t('app.addPermission')} - ${t(`app.permissionType.${permissionType}`)}`;

  return (
    <Modal
      title={modalTitle}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      width={700}
      okText={`${t('common.add')} (${totalSelected})`}
      okButtonProps={{ disabled: totalSelected === 0 || (mode === 'role' && !selectedAppRole) }}
      cancelText={t('common.cancel')}
    >
      {mode === 'role' && (
        <div style={{ marginBottom: 16 }}>
          <Text strong>{t('app.selectRole') || '选择角色'}:</Text>
          {appRoles.length > 0 ? (
            <Select
              value={selectedAppRole}
              onChange={setSelectedAppRole}
              style={{ width: '100%', marginTop: 8 }}
              placeholder={t('app.selectRolePlaceholder') || '请选择要授予的角色'}
            >
              {appRoles.map((role) => (
                <Select.Option key={role._id || role.id} value={role._id || role.id}>
                  {role.name}
                </Select.Option>
              ))}
            </Select>
          ) : (
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4 }}>
              <Text type="danger" style={{ fontSize: 13 }}>
                {t('app.noRolesAvailable') || '当前应用尚未创建任何应用角色，请先在“应用角色管理”中创建角色。'}
              </Text>
            </div>
          )}
        </div>
      )}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => {
          setActiveTab(k);
          setSearchText('');
        }}
        items={items}
      />
    </Modal>
  );
};

export default ResourceSelectorModal;
