import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Space, Button, Checkbox, Table, Typography, Empty, message } from 'antd';
import { getForm } from '../../../api/forms';

const { Text } = Typography;

/**
 * FieldPermissionModal
 * 字段权限配置弹框：选择哪些字段可以显示和编辑。
 * Props:
 *  - open: 是否显示
 *  - onClose: 关闭回调
 *  - onSave(permissions): 保存后回调，返回 { fieldId: { visible: bool, editable: bool } }
 *  - appId, formId: 用于内部懒加载 schema
 *  - initialPermissions: 初始权限配置（可选）
 *  - showEditable: 是否显示可编辑列（默认 true）
 */
const FieldPermissionModal = ({
  open,
  onClose,
  onSave,
  appId,
  formId,
  initialPermissions = {},
  showEditable = true,
}) => {
  const [permissions, setPermissions] = useState({});
  const [formSchema, setFormSchema] = useState(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [schemaError, setSchemaError] = useState(false);

  const loadSchema = useCallback(async () => {
    if (!appId || !formId) return;
    setLoadingSchema(true);
    setSchemaError(false);
    try {
      const schema = await getForm(appId, formId);
      setFormSchema(schema);
    } catch (e) {
      console.error('Failed to load form schema:', e);
      setSchemaError(true);
      message.error('加载表单结构失败，可重试');
    } finally {
      setLoadingSchema(false);
    }
  }, [appId, formId]);

  // Lazy load schema when modal opens
  useEffect(() => {
    if (open && !formSchema && !loadingSchema && !schemaError) {
      loadSchema();
    }
  }, [open, formSchema, loadingSchema, schemaError, loadSchema]);

  // Initialize permissions once schema is available
  useEffect(() => {
    if (open && formSchema?.fields) {
      const init = {};
      formSchema.fields.forEach((field) => {
        init[field.id] = initialPermissions[field.id] || { visible: false, editable: false };
      });
      setPermissions(init);
    }
  }, [open, formSchema, initialPermissions]);

  const handleVisibleChange = (fieldId, checked) => {
    setPermissions((prev) => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        visible: checked,
        editable: checked ? prev[fieldId].editable : false,
      },
    }));
  };

  const handleEditableChange = (fieldId, checked) => {
    setPermissions((prev) => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], editable: checked },
    }));
  };

  const handleSelectAll = (type) => {
    const newPerms = { ...permissions };
    Object.keys(newPerms).forEach((fieldId) => {
      if (type === 'visible') {
        newPerms[fieldId].visible = true;
      } else if (type === 'editable') {
        if (newPerms[fieldId].visible) {
          newPerms[fieldId].editable = true;
        }
      }
    });
    setPermissions(newPerms);
  };

  const handleClearAll = (type) => {
    const newPerms = { ...permissions };
    Object.keys(newPerms).forEach((fieldId) => {
      if (type === 'visible') {
        newPerms[fieldId].visible = false;
        newPerms[fieldId].editable = false;
      } else if (type === 'editable') {
        newPerms[fieldId].editable = false;
      }
    });
    setPermissions(newPerms);
  };

  const handleToggleAll = (type, checked) => {
    if (checked) {
      handleSelectAll(type);
    } else {
      handleClearAll(type);
    }
  };

  const isAllSelected = (type) => {
    const perms = Object.values(permissions);
    if (perms.length === 0) return false;
    if (type === 'visible') {
      return perms.every((p) => p.visible);
    } else if (type === 'editable') {
      return perms.every((p) => p.editable);
    }
    return false;
  };

  const handleSave = () => {
    onSave(permissions);
    onClose();
  };

  const columns = [
    {
      title: '字段名称',
      dataIndex: 'label',
      key: 'label',
      width: showEditable ? '40%' : '60%',
      render: (text, record) => (
        <Space>
          <Text strong>{text || record.id}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ({record.type})
          </Text>
        </Space>
      ),
    },
    {
      title: () => (
        <Checkbox
          checked={isAllSelected('visible')}
          onChange={(e) => handleToggleAll('visible', e.target.checked)}
        >
          可显示
        </Checkbox>
      ),
      dataIndex: 'visible',
      key: 'visible',
      width: showEditable ? '30%' : '40%',
      align: 'center',
      render: (_, record) => (
        <Checkbox
          checked={permissions[record.id]?.visible}
          onChange={(e) => handleVisibleChange(record.id, e.target.checked)}
        />
      ),
    },
    ...(showEditable
      ? [
          {
            title: () => (
              <Checkbox
                checked={isAllSelected('editable')}
                onChange={(e) => handleToggleAll('editable', e.target.checked)}
              >
                可编辑
              </Checkbox>
            ),
            dataIndex: 'editable',
            key: 'editable',
            width: '30%',
            align: 'center',
            render: (_, record) => (
              <Checkbox
                checked={permissions[record.id]?.editable}
                disabled={!permissions[record.id]?.visible}
                onChange={(e) => handleEditableChange(record.id, e.target.checked)}
              />
            ),
          },
        ]
      : []),
  ];

  const dataSource =
    formSchema?.fields?.map((field) => ({
      id: field.id,
      label: field.properties?.label || field.id,
      type: field.type,
      key: field.id,
    })) || [];

  return (
    <Modal
      open={open}
      title="配置字段权限"
      onCancel={onClose}
      width={800}
      destroyOnClose
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>
            确定
          </Button>
        </Space>
      }
    >
      {schemaError && (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Empty description="表单结构加载失败" />
          <Button onClick={loadSchema} loading={loadingSchema} type="primary">
            重试加载
          </Button>
        </Space>
      )}
      {!schemaError && loadingSchema && <Text type="secondary">字段结构加载中...</Text>}
      {!schemaError && !loadingSchema && (!formSchema?.fields || !formSchema.fields.length) && (
        <Empty description="暂无字段可配置" />
      )}
      {!schemaError && !loadingSchema && formSchema?.fields?.length > 0 && (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {showEditable
              ? '选择用户访问单条数据分享链接时，哪些字段可以显示、哪些字段可以编辑。可编辑字段必须先设为可显示。'
              : '选择用户访问公开查询链接时可以看到的字段。'}
          </Text>
          <Table
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            size="small"
            scroll={{ y: 400 }}
          />
        </Space>
      )}
    </Modal>
  );
};

export default FieldPermissionModal;
