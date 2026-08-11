import React, { useState } from 'react';
import { Modal, Form, Input, Button, Table, message, Space, Select, Upload, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useOrg } from '../store/OrgContext';
import { batchCreateMembers } from '../api/members';

const { Option } = Select;

const BatchCreateMembersModal = ({ open, onCancel, onSuccess, roles = [] }) => {
  const { t } = useTranslation();
  const { currentOrganization } = useOrg();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([
    { key: 1, username: '', email: '', password: '', roleIds: [], nickname: '' },
  ]);

  const columns = [
    {
      title: t('member.username') || 'Username',
      dataIndex: 'username',
      key: 'username',
      width: '20%',
      render: (text, record) => (
        <Input
          value={text}
          placeholder="username"
          onChange={(e) => updateMember(record.key, 'username', e.target.value)}
        />
      ),
    },
    {
      title: t('member.email') || 'Email',
      dataIndex: 'email',
      key: 'email',
      width: '25%',
      render: (text, record) => (
        <Input
          value={text}
          placeholder="user@example.com"
          type="email"
          onChange={(e) => updateMember(record.key, 'email', e.target.value)}
        />
      ),
    },
    {
      title: t('member.password') || 'Password',
      dataIndex: 'password',
      key: 'password',
      width: '20%',
      render: (text, record) => (
        <Input.Password
          value={text}
          placeholder="123456"
          onChange={(e) => updateMember(record.key, 'password', e.target.value)}
        />
      ),
    },
    {
      title: t('member.roles') || 'Roles',
      dataIndex: 'roleIds',
      key: 'roleIds',
      width: '25%',
      render: (roleIds, record) => (
        <Select
          mode="multiple"
          value={roleIds}
          placeholder={t('member.selectRoles') || 'Select roles'}
          style={{ width: '100%' }}
          onChange={(value) => updateMember(record.key, 'roleIds', value)}
        >
          {roles.map((role) => (
            <Option key={role.id || role._id} value={role.id || role._id}>
              {role.name}
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: t('common.action') || 'Action',
      key: 'action',
      width: '10%',
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeMember(record.key)}
          disabled={members.length === 1}
        />
      ),
    },
  ];

  const updateMember = (key, field, value) => {
    setMembers((prev) => prev.map((m) => (m.key === key ? { ...m, [field]: value } : m)));
  };

  const removeMember = (key) => {
    setMembers((prev) => prev.filter((m) => m.key !== key));
  };

  const addMember = () => {
    const newKey = Math.max(...members.map((m) => m.key)) + 1;
    setMembers((prev) => [
      ...prev,
      { key: newKey, username: '', email: '', password: '', roleIds: [], nickname: '' },
    ]);
  };

  const handleSubmit = async () => {
    // Validation
    const invalidMembers = members.filter((m) => !m.username || !m.email || !m.password);
    if (invalidMembers.length > 0) {
      message.error(t('member.fillAllFields') || 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const data = await batchCreateMembers(currentOrganization.id, members);
      const { summary, results } = data;

      if (summary.failed > 0) {
        message.warning(
          `${summary.succeeded} ${t('member.succeeded') || 'succeeded'}, ${summary.failed} ${t('member.failed') || 'failed'}`,
        );
      } else {
        message.success(
          `${summary.succeeded} ${t('member.membersCreated') || 'members created successfully'}`,
        );
      }

      onSuccess?.(results);
      handleClose();
    } catch (error) {
      message.error(error.message || t('member.createFailed') || 'Failed to create members');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMembers([{ key: 1, username: '', email: '', password: '', roleIds: [], nickname: '' }]);
    onCancel?.();
  };

  return (
    <Modal
      title={t('member.batchCreateMembers') || '批量添加成员'}
      open={open}
      onCancel={handleClose}
      width={1000}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          {t('common.cancel') || 'Cancel'}
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          {t('member.createAll') || `Create ${members.length} Member(s)`}
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Table
          columns={columns}
          dataSource={members}
          pagination={false}
          bordered
          size="small"
          scroll={{ x: 800 }}
        />

        <Button type="dashed" onClick={addMember} block icon={<PlusOutlined />}>
          {t('member.addAnother') || 'Add Another Member'}
        </Button>

        <Divider />

        <div style={{ color: '#666', fontSize: 12 }}>
          <strong>{t('member.tips') || 'Tips'}:</strong>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>{t('member.tip1') || 'Username and email must be unique across the system'}</li>
            <li>{t('member.tip2') || 'Password must be at least 6 characters'}</li>
            <li>
              {t('member.tip3') || 'If role is not selected, member will have no permissions'}
            </li>
          </ul>
        </div>
      </Space>
    </Modal>
  );
};

export default BatchCreateMembersModal;
