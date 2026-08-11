import React, { useState, useEffect } from 'react';
import { Modal, Table, Input, message, Tag, Space, Avatar, Typography } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { batchAddMembersToDepartment } from '../api/members';

const { Text } = Typography;

const AddDeptMembersModal = ({ open, onCancel, onSuccess, currentDept, allMembers }) => {
  const { t } = useTranslation();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedRowKeys([]);
      setSearchText('');
    }
  }, [open]);

  // Filter members who are NOT already in the current department
  const filteredMembers = allMembers.filter((member) => {
    const isInDept = member.departments?.some(
      (d) => d.id === currentDept?.id || d._id === currentDept?.id,
    );
    if (isInDept) return false;

    if (!searchText) return true;

    const searchLower = searchText.toLowerCase();
    return (
      member.user?.username?.toLowerCase().includes(searchLower) ||
      member.user?.nickname?.toLowerCase().includes(searchLower) ||
      member.user?.email?.toLowerCase().includes(searchLower)
    );
  });

  const handleOk = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning(t('department.selectMembersWarning') || 'Please select at least one member');
      return;
    }

    try {
      setLoading(true);
      await batchAddMembersToDepartment(currentDept.id, selectedRowKeys);
      message.success(t('department.addMembersSuccess') || 'Members added successfully');
      onSuccess();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('organization.member') || 'Member',
      dataIndex: 'user',
      key: 'user',
      render: (user) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }}>
            {user?.nickname?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
            <Text strong style={{ fontSize: 13 }}>
              {user?.nickname || user?.username}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
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
            <Tag key={role.id || role._id} size="small">
              {role.name}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title={`${t('department.addMembers') || 'Add Members to'} - ${currentDept?.name}`}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={700}
      okText={t('common.add') || 'Add'}
    >
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder={t('organization.searchMember') || 'Search members...'}
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
      </div>
      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        columns={columns}
        dataSource={filteredMembers}
        rowKey={(record) => record.id || record._id}
        pagination={{
          pageSize: 8,
          showTotal: (total) => `${t('common.total') || 'Total'} ${total}`,
        }}
        size="small"
        scroll={{ y: 400 }}
      />
    </Modal>
  );
};

export default AddDeptMembersModal;
