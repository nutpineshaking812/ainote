import React, { useState, useEffect } from 'react';
import { Typography, Space, Switch, Button, Divider, message, Empty } from 'antd';
import { useParams } from 'react-router-dom';
import FieldPermissionModal from './FieldPermissionModal';
import { getRecordShareConfig, updateRecordShareConfig } from '../../../api/publish';

const { Text } = Typography;

// 单条数据分享：配置字段权限（全局默认，可用于创建每条记录的初始权限）
const RecordShareLink = ({ formId, link }) => {
  const { appId } = useParams();
  const [loading, setLoading] = useState(true);
  const [localSettings, setLocalSettings] = useState({ isPublic: false, fieldPermissions: {} });
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [fieldPermissions, setFieldPermissions] = useState({});
  // schema 由 FieldPermissionModal 内部懒加载

  // Load global record share defaults (no creation if missing)
  useEffect(() => {
    const loadCfg = async () => {
      if (!appId || !formId) return;
      try {
        setLoading(true);
        const cfg = await getRecordShareConfig(appId, formId);
        setLocalSettings((ls) => ({
          ...ls,
          isPublic: !!cfg.isPublic,
          fieldPermissions: cfg.defaultFieldPermissions || {},
        }));
      } catch (e) {
        console.error(e);
        message.error('加载单条数据分享配置失败');
      } finally {
        setLoading(false);
      }
    };
    loadCfg();
  }, [appId, formId]);

  // 初始化字段权限（仅从 settings 恢复；默认模板由 modal 打开后生成）
  useEffect(() => {
    if (Object.keys(localSettings.fieldPermissions || {}).length > 0) {
      setFieldPermissions(localSettings.fieldPermissions);
    }
  }, [localSettings.fieldPermissions]);

  const persist = async () => {
    try {
      await updateRecordShareConfig(appId, formId, {
        isPublic: localSettings.isPublic,
        defaultFieldPermissions: fieldPermissions || {},
      });
      message.success('单条数据分享配置已保存');
    } catch (e) {
      console.error(e);
      message.error('保存失败');
    }
  };

  const handleTogglePublic = (checked) => {
    const newSettings = { ...localSettings, isPublic: checked };
    if (!checked) {
      // 关闭立即保存
      setLocalSettings(newSettings);
      (async () => {
        try {
          await updateRecordShareConfig(appId, formId, {
            isPublic: newSettings.isPublic,
            defaultFieldPermissions: fieldPermissions || {},
          });
          message.success('已关闭单条数据分享并保存');
        } catch (e) {
          console.error(e);
          message.error('关闭保存失败');
        }
      })();
    } else {
      // 开启仅本地，等待用户最终保存
      setLocalSettings(newSettings);
      message.success('已开启单条数据分享（需保存）');
    }
  };

  const handleSavePermissions = (permissions) => {
    setFieldPermissions(permissions);
    setLocalSettings((ls) => ({ ...ls, fieldPermissions: permissions }));
    message.success('字段权限已更新（需保存）');
  };

  const getPermissionSummary = () => {
    const visibleCount = Object.values(fieldPermissions).filter((p) => p.visible).length;
    const editableCount = Object.values(fieldPermissions).filter((p) => p.editable).length;
    const totalCount = Object.keys(fieldPermissions).length;
    if (totalCount === 0) return '未配置';
    return `${visibleCount}/${totalCount} 可显示，${editableCount}/${totalCount} 可编辑`;
  };

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size={20}>
        {loading && <Text type="secondary">配置加载中...</Text>}
        <Space align="center" wrap>
          <Text strong>启用单条数据分享</Text>
          <Switch checked={localSettings.isPublic} onChange={handleTogglePublic} />
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            开启后，可配置字段权限并生成分享链接。
          </Text>
        </Space>

        {localSettings.isPublic && (
          <>
            <Divider style={{ margin: '12px 0' }} />

            {/* 字段权限配置 */}
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Space align="center">
                  <Text strong>外链权限配置</Text>
                  <Button type="primary" onClick={() => setShowPermissionModal(true)}>
                    配置字段权限
                  </Button>
                </Space>
                <div
                  style={{
                    padding: 12,
                    background: '#fafafa',
                    borderRadius: 6,
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <Space direction="vertical" size={4}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      配置用户访问分享链接时可以看到和编辑的字段
                    </Text>
                    <Text style={{ fontSize: 13 }}>
                      当前配置：<Text strong>{getPermissionSummary()}</Text>
                    </Text>
                  </Space>
                </div>
              </Space>
            </Space>
            <Divider style={{ margin: '12px 0' }} />
            <Button type="primary" onClick={persist}>
              保存
            </Button>
          </>
        )}
      </Space>

      <FieldPermissionModal
        open={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        onSave={handleSavePermissions}
        appId={appId}
        formId={formId}
        initialPermissions={fieldPermissions}
      />
    </div>
  );
};

export default RecordShareLink;
