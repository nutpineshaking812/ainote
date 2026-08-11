import React, { useState, useEffect } from 'react';
import { Modal, Select, Button, List, Avatar, Space, Tag, message, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  UserOutlined,
  TeamOutlined,
  DeploymentUnitOutlined,
  GlobalOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { getOrganizationMembers } from '../../../api/organizations';
import { getGlobalRoles } from '../../../api/roles';
import { getOrganizationDepartments } from '../../../api/departments';
import { useOrg } from '../../../store/OrgContext';
import ResourceSelectorModal from '../../../components/ResourceSelectorModal';

const { Option } = Select;
const { Text } = Typography;

const DocumentShareModal = ({ open, onCancel, onSave, doc, title }) => {
  const { t } = useTranslation();
  const { currentOrganization } = useOrg();
  const organizationId = currentOrganization?.id || currentOrganization?._id;

  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState([]);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [defaultPermission, setDefaultPermission] = useState('VIEW');

  // Options State
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    if (doc && doc.shares) {
      setShares([...doc.shares]);
    } else {
      setShares([]);
    }
  }, [doc]);

  useEffect(() => {
    if (open && organizationId) {
      loadOptions();
    }
  }, [open, organizationId]);

  const loadOptions = async () => {
    try {
      const [membersRes, deptsRes, rolesRes] = await Promise.all([
        getOrganizationMembers(organizationId),
        getOrganizationDepartments(organizationId),
        getGlobalRoles(organizationId),
      ]);
      setMembers(Array.isArray(membersRes) ? membersRes : membersRes?.members || []);
      setMembers(Array.isArray(membersRes) ? membersRes : membersRes?.members || []);

      const rawDepts = Array.isArray(deptsRes) ? deptsRes : deptsRes?.departments || [];
      const flattenDepts = (list) => {
        let res = [];
        list.forEach((d) => {
          res.push(d);
          if (d.children?.length) {
            res = res.concat(flattenDepts(d.children));
          }
        });
        return res;
      };
      // Keep tree for selector if needed, but we need flat list for lookup.
      // But ResourceSelectorModal expects the tree to display hierarchy?
      // ResourceSelectorModal takes 'departments' prop.
      // AppPermissionsPage ResourceSelectorModal probably expects the list as passed.
      // If we pass flat list to ResourceSelectorModal, it loses hierarchy.
      // So we should store BOTH or just simple-flatten for lookup?
      // Actually DocumentShareModal passes `departments` to ResourceSelector.
      // If I flatten it here, ResourceSelector shows flat list.
      // Antd Table handles tree, so better pass TREE to ResourceSelector
      // BUT use FLATTENED list for getTargetName.

      // Let's store tree in 'departments' state (for selector)
      // AND create a 'flatDepartments' map or list for lookup.
      // For simplicity in this functional component, I'll just helper function inside getTargetName
      // OR I'll store flatDepartments in a ref or useMemo.

      setDepartments(rawDepts); // Keep tree structure for selector
      setRoles(Array.isArray(rolesRes) ? rolesRes : rolesRes?.roles || []);
    } catch (error) {
      console.error('Failed to load share options', error);
      message.error(t('common.loadFailed'));
    }
  };

  const handleAddFromSelector = (selectedItems) => {
    const newShares = [...shares];
    let addedCount = 0;

    selectedItems.forEach((item) => {
      // Check if already exists
      const exists = newShares.find(
        (s) => s.targetType === item.type && (s.targetType === 'ALL' || s.targetId === item.id),
      );

      if (!exists) {
        newShares.push({
          targetType: item.type,
          targetId: item.type === 'ALL' ? null : item.id,
          permission: defaultPermission,
        });
        addedCount++;
      }
    });

    setShares(newShares);
    setSelectorVisible(false);
    if (addedCount > 0) {
      message.success(t('document.addShareSuccess') || `Added ${addedCount} items`);
    } else {
      message.info(t('document.noNewItems') || 'No new items added');
    }
  };

  const handleRemove = (index) => {
    const newShares = [...shares];
    newShares.splice(index, 1);
    setShares(newShares);
  };

  const handleOk = async () => {
    setLoading(true);
    try {
      await onSave(doc._id || doc.id, shares);
      message.success(t('document.shareSuccess'));
      onCancel();
    } catch (error) {
      message.error(t('document.shareFailed'));
    } finally {
      setLoading(false);
    }
  };

  const getTargetName = (item) => {
    if (item.targetType === 'ALL') return t('app.targetType.ALL');
    if (item.targetType === 'USER') {
      const member = members.find((m) => {
        if (!m || !m.user) return false;
        const uId = m.user._id || m.user.id || m.user;
        return uId === item.targetId;
      });
      if (member && member.user) {
        const u = member.user;
        return u.nickname || u.username || (typeof u === 'string' ? u : 'Unknown');
      }
      return item.targetId || 'Unknown User';
    }
    if (item.targetType === 'DEPARTMENT') {
      const findDept = (list) => {
        for (const d of list) {
          if (d.id === item.targetId || d._id === item.targetId) return d;
          if (d.children) {
            const found = findDept(d.children);
            if (found) return found;
          }
        }
        return null;
      };
      const dept = findDept(departments);
      return dept ? dept.name : t('common.unknown') || 'Unknown Dept';
    }
    if (item.targetType === 'ROLE') {
      const role = roles.find((r) => r.id === item.targetId || r._id === item.targetId);
      return role ? role.name : 'Unknown Role';
    }
    return item.targetId;
  };

  const renderTargetIcon = (type) => {
    switch (type) {
      case 'USER':
        return <UserOutlined />;
      case 'DEPARTMENT':
        return <DeploymentUnitOutlined />;
      case 'ROLE':
        return <TeamOutlined />;
      case 'ALL':
        return <GlobalOutlined />;
      default:
        return null;
    }
  };

  return (
    <Modal
      title={title || t('document.shareTitle')}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={600}
    >
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Text>{t('document.defaultPermission') || 'Default Permission'}:</Text>
          <Select value={defaultPermission} onChange={setDefaultPermission} style={{ width: 100 }}>
            <Option value="VIEW">{t('document.permission.VIEW')}</Option>
            <Option value="EDIT">{t('document.permission.EDIT')}</Option>
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setSelectorVisible(true)}>
          {t('document.addMember') || 'Add Member'}
        </Button>
      </div>

      <List
        dataSource={shares}
        bordered
        style={{ maxHeight: 400, overflowY: 'auto' }}
        renderItem={(item, index) => (
          <List.Item
            actions={[
              <Select
                key="perm"
                size="small"
                value={item.permission}
                style={{ width: 100 }}
                onChange={(val) => {
                  const newShares = [...shares];
                  newShares[index].permission = val;
                  setShares(newShares);
                }}
              >
                <Option value="VIEW">{t('document.permission.VIEW')}</Option>
                <Option value="EDIT">{t('document.permission.EDIT')}</Option>
              </Select>,
              <Button
                key="del"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemove(index)}
              />,
            ]}
          >
            <List.Item.Meta
              avatar={<Avatar icon={renderTargetIcon(item.targetType)} />}
              title={
                <Space>
                  <Text>{getTargetName(item)}</Text>
                </Space>
              }
              description={t(`app.targetType.${item.targetType}`)}
            />
          </List.Item>
        )}
      />

      <ResourceSelectorModal
        open={selectorVisible}
        onCancel={() => setSelectorVisible(false)}
        onOk={handleAddFromSelector}
        permissionType={defaultPermission}
        roles={roles}
        departments={departments}
        members={members}
      />
    </Modal>
  );
};

export default DocumentShareModal;
