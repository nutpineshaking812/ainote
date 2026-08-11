import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Table, Button, Select, Space, message, Typography, Empty, Avatar, Input } from 'antd';
import {
  GlobalOutlined,
  UserOutlined,
  ApartmentOutlined,
  TeamOutlined,
  DeleteOutlined,
  FormOutlined,
  TableOutlined,
  SafetyOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { getFormsByAppId, shareForm } from '../../../api/forms';
import { getViewsByAppId, shareView } from '../../../api/views';
import { getOrganizationDepartments } from '../../../api/departments';
import { getOrganizationMembers } from '../../../api/organizations';
import { getGlobalRoles } from '../../../api/roles';
import { useOrg } from '../../../store/OrgContext';
import PermissionAuditModal from '../../../components/PermissionAuditModal';
import ResourceSelectorModal from '../../../components/ResourceSelectorModal';

const { Text } = Typography;
const { Option } = Select;

const ResourcePermissions = () => {
  const { t } = useTranslation();
  const { appId } = useParams();
  const { currentOrganization } = useOrg();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [currentResource, setCurrentResource] = useState(null);

  // States for adding permissions
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [defaultPermission, setDefaultPermission] = useState('form:view');

  // Options for name resolution
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [members, setMembers] = useState([]);

  // Audit state
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditTargetResourceId, setAuditTargetResourceId] = useState(null);

  const organizationId = currentOrganization?.id || currentOrganization?._id;

  const loadData = async () => {
    setLoading(true);
    try {
      // Load both Forms and Views
      const [forms, views] = await Promise.all([
        getFormsByAppId(appId).catch(() => []),
        getViewsByAppId(appId).catch(() => []),
      ]);

      // Merge and tag
      const merged = [
        ...(forms || []).map((f) => ({ ...f, resourceType: 'FORM' })),
        ...(views || []).map((v) => ({ ...v, resourceType: 'VIEW' })),
      ];

      // Sort by Name
      merged.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      setData(merged);
    } catch (e) {
      console.error(e);
      message.error(t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    if (!organizationId) return;
    try {
      const [rolesData, deptsData, membersData] = await Promise.all([
        getGlobalRoles(organizationId).catch(() => []),
        getOrganizationDepartments(organizationId).catch(() => []),
        getOrganizationMembers(organizationId).catch(() => []),
      ]);
      setRoles(rolesData?.roles || rolesData || []);

      const rawDepts = deptsData?.departments || deptsData || [];
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
      setDepartments(flattenDepts(rawDepts));

      setMembers(membersData?.members || membersData || []);
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  useEffect(() => {
    if (appId) {
      loadData();
      loadOptions();
    }
  }, [appId, organizationId]);

  // Update filtered list
  const filteredResources = data.filter((item) =>
    (item.name || '').toLowerCase().includes(searchText.toLowerCase()),
  );

  // Helper to get formatted target name
  const getShareInfo = (share) => {
    if (share.targetType === 'ALL') {
      return { name: t('app.targetType.ALL'), type: 'ALL', icon: <GlobalOutlined /> };
    }
    if (share.targetType === 'USER') {
      const m = members.find((m) => {
        const uid = m.user?._id || m.user?.id || m.user;
        return uid === share.targetId;
      });
      const user = m?.user || {};
      const name = user.nickname || user.username || t('common.unknown');
      return { name, type: 'USER', icon: <UserOutlined /> };
    }
    if (share.targetType === 'DEPARTMENT') {
      const d = departments.find((d) => (d.id || d._id) === share.targetId);
      return {
        name: d?.name || t('common.unknownDept') || 'Unknown Dept',
        type: 'DEPARTMENT',
        icon: <ApartmentOutlined />,
      };
    }
    if (share.targetType === 'ROLE') {
      const r = roles.find((r) => (r.id || r._id) === share.targetId);
      return {
        name: r?.name || t('common.unknownRole') || 'Unknown Role',
        type: 'ROLE',
        icon: <TeamOutlined />,
      };
    }
    return { name: t('common.unknown'), type: 'UNKNOWN', icon: null };
  };

  // Actions
  const handleUpdate = async (newShares) => {
    if (!currentResource) return;
    try {
      const id = currentResource._id || currentResource.id;

      // Dynamic API call based on resource type
      if (currentResource.resourceType === 'FORM') {
        await shareForm(id, newShares);
      } else {
        await shareView(appId, id, newShares);
      }

      // Update local state
      const newData = data.map((item) => {
        if ((item._id || item.id) === id) {
          return { ...item, shares: newShares };
        }
        return item;
      });
      setData(newData);

      // Update current resource reference
      const updatedResource = newData.find((i) => (i._id || i.id) === id);
      setCurrentResource(updatedResource);
      message.success(t('app.updateSuccess'));
    } catch (e) {
      message.error(t('common.operationFailed'));
    }
  };

  const handleAdd = (startItems) => {
    const currentShares = currentResource.shares || [];
    const newItems = [];

    startItems.forEach((item) => {
      let targetType = item.type;
      const exists = currentShares.some(
        (s) => s.targetType === targetType && s.targetId === item.id,
      );
      if (!exists) {
        newItems.push({
          targetType,
          targetId: item.id,
          permission: defaultPermission,
        });
      }
    });

    if (newItems.length > 0) {
      handleUpdate([...currentShares, ...newItems]);
    }
    setSelectorVisible(false);
  };

  const handleRemoveShare = (index) => {
    const newShares = [...(currentResource.shares || [])];
    newShares.splice(index, 1);
    handleUpdate(newShares);
  };

  const handlePermissionChange = (val, index) => {
    const newShares = [...(currentResource.shares || [])];
    newShares[index].permission = val;
    handleUpdate(newShares);
  };

  // Columns for the Detail Table
  const detailColumns = [
    {
      title: t('appSettings.target'),
      key: 'target',
      render: (_, record) => {
        const info = getShareInfo(record);
        return (
          <Space>
            <Avatar icon={info.icon} size="small" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text strong>{info.name}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t(`app.targetType.${info.type}`)}
              </Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: t('appSettings.permissionType'),
      key: 'permission',
      width: 150,
      render: (_, record, index) => {
        const isForm = currentResource.resourceType === 'FORM';
        return (
          <Select
            value={record.permission}
            style={{ width: '100%' }}
            size="small"
            onChange={(val) => handlePermissionChange(val, index)}
          >
            {isForm ? (
              <>
                <Option value="form:view">{t('app.permissionType.VIEW') || '查看数据'}</Option>
                <Option value="form:fill">{t('app.permissionType.FILL') || '填写数据'}</Option>
                <Option value="form:design">{t('app.permissionType.DESIGN') || '设计表单'}</Option>
                <Option value="form:export">{t('app.permissionType.EXPORT') || '导出数据'}</Option>
              </>
            ) : (
              <>
                <Option value="view:view">{t('app.permissionType.VIEW') || '查看视图'}</Option>
                <Option value="view:design">{t('app.permissionType.DESIGN') || '设计视图'}</Option>
              </>
            )}
          </Select>
        );
      },
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 80,
      render: (_, __, index) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveShare(index)}
        />
      ),
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        height: '600px',
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
      }}
    >
      {/* Left Panel: List */}
      <div
        style={{
          width: 260,
          borderRight: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
          <Input.Search
            placeholder={t('common.search')}
            allowClear
            size="small"
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredResources.map((item) => (
            <div
              key={item._id || item.id}
              onClick={() => setCurrentResource(item)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background:
                  currentResource &&
                  (currentResource._id || currentResource.id) === (item._id || item.id)
                    ? '#e6f7ff'
                    : 'transparent',
                borderRight:
                  currentResource &&
                  (currentResource._id || currentResource.id) === (item._id || item.id)
                    ? '2px solid #1890ff'
                    : 'none',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Space>
                {item.resourceType === 'FORM' ? (
                  <FormOutlined style={{ color: '#1890ff' }} />
                ) : (
                  <TableOutlined style={{ color: '#52c41a' }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <Text ellipsis={{ tooltip: item.name }} style={{ maxWidth: 180, fontSize: 13 }}>
                    {item.name}
                  </Text>
                </div>
              </Space>
            </div>
          ))}
          {filteredResources.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
        </div>
      </div>

      {/* Right Panel: Details */}
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fafafa' }}
      >
        {currentResource ? (
          <>
            <div
              style={{
                padding: '12px 16px',
                background: '#fff',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Space>
                {currentResource.resourceType === 'FORM' ? (
                  <FormOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                ) : (
                  <TableOutlined style={{ fontSize: 18, color: '#52c41a' }} />
                )}
                <Text strong style={{ fontSize: 15 }}>
                  {currentResource.name}
                </Text>
                <Button
                  type="text"
                  size="small"
                  icon={<SafetyOutlined />}
                  onClick={() => {
                    setAuditTargetResourceId(currentResource._id || currentResource.id);
                    setAuditModalOpen(true);
                  }}
                >
                  {t('common.audit')}
                </Button>
              </Space>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setSelectorVisible(true)}
              >
                {t('document.addMember')}
              </Button>
            </div>
            <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
              <Table
                dataSource={currentResource.shares || []}
                columns={detailColumns}
                rowKey={(r) => `${r.targetType}-${r.targetId}`}
                pagination={false}
                size="small"
                locale={{ emptyText: t('appSettings.noPermissions') }}
              />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Empty description={t('common.selectItem')} />
          </div>
        )}
      </div>

      <ResourceSelectorModal
        open={selectorVisible}
        onCancel={() => setSelectorVisible(false)}
        onOk={handleAdd}
        permissionType={defaultPermission}
        roles={roles}
        departments={departments}
        members={members}
      />

      <PermissionAuditModal
        open={auditModalOpen}
        onClose={() => {
          setAuditModalOpen(false);
          setAuditTargetResourceId(null);
        }}
        resourceId={auditTargetResourceId}
        title={t('audit.resourceTitle')}
      />
    </div>
  );
};

export default ResourcePermissions;
