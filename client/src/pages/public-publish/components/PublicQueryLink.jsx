import React, { useState, useEffect } from 'react';
import { Typography, Space, Switch, Button, message, Divider, Empty } from 'antd';
import dayjs from 'dayjs';
import useExpiryStatus from './useExpiryStatus';
import LinkActionsBar from './LinkActionsBar';
import FillRestrictionsPanel from './FillRestrictionsPanel';
import FieldPermissionModal from './FieldPermissionModal';
import { useParams } from 'react-router-dom';
import { getForm } from '../../../api/forms';
import { getQueryConfig, updateQueryConfig } from '../../../api/publish';

const { Text } = Typography;

const PublicQueryLink = ({ formId, link }) => {
  const { appId } = useParams();
  const [loading, setLoading] = useState(true);
  const [localSettings, setLocalSettings] = useState({
    isPublic: false,
    useAccessCode: false,
    accessCode: '',
    useLinkExpiry: false,
    linkExpiresAt: null,
    fieldPermissions: {},
  });
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [linkExpiryType, setLinkExpiryType] = useState('never'); // 30|60|360|1440|10080|never|custom
  const [linkCustomExpiry, setLinkCustomExpiry] = useState(null);
  const { remainingText, isExpired } = useExpiryStatus(localSettings.linkExpiresAt);
  // 字段权限配置
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [fieldPermissions, setFieldPermissions] = useState({});
  // schema 由 FieldPermissionModal 内部懒加载

  // Load query config (no creation if missing)
  useEffect(() => {
    const loadCfg = async () => {
      if (!appId || !formId) return;
      setLoading(true);
      try {
        const cfg = await getQueryConfig(appId, formId);
        setLocalSettings((ls) => ({
          ...ls,
          isPublic: !!cfg.isPublic,
          useAccessCode: !!cfg.useAccessCode,
          accessCode: cfg.accessCode || '',
          useLinkExpiry: !!cfg.useLinkExpiry,
          linkExpiresAt: cfg.linkExpiresAt || null,
          fieldPermissions: cfg.fieldPermissions || {},
        }));
      } catch (e) {
        console.error(e);
        message.error('加载公开查询配置失败');
      } finally {
        setLoading(false);
      }
    };
    loadCfg();
  }, [appId, formId]);

  const persist = async () => {
    try {
      await updateQueryConfig(appId, formId, {
        isPublic: localSettings.isPublic,
        useAccessCode: localSettings.useAccessCode,
        accessCode: localSettings.accessCode,
        useLinkExpiry: localSettings.useLinkExpiry,
        linkExpiresAt: localSettings.linkExpiresAt,
        fieldPermissions: fieldPermissions || {},
      });
      message.success('公开查询配置已保存');
    } catch (e) {
      console.error(e);
      message.error('保存失败');
    }
  };

  const handleToggle = (checked) => {
    const newSettings = { ...localSettings, isPublic: checked };
    if (!checked) {
      // 关闭时清理相关限制并立即保存
      newSettings.useAccessCode = false;
      newSettings.accessCode = '';
      newSettings.useLinkExpiry = false;
      newSettings.linkExpiresAt = null;
      setLocalSettings(newSettings);
      (async () => {
        try {
          await updateQueryConfig(appId, formId, {
            isPublic: newSettings.isPublic,
            useAccessCode: newSettings.useAccessCode,
            accessCode: newSettings.accessCode,
            useLinkExpiry: newSettings.useLinkExpiry,
            linkExpiresAt: newSettings.linkExpiresAt,
            fieldPermissions: fieldPermissions || {},
          });
          message.success('已关闭公开查询并保存');
        } catch (e) {
          console.error(e);
          message.error('关闭保存失败');
        }
      })();
    } else {
      // 开启仅本地，等待用户最终保存
      setLocalSettings(newSettings);
      message.success('已开启公开查询（需保存）');
    }
  };

  const handleAccessCodeToggle = (checked) => {
    const newSettings = { ...localSettings, useAccessCode: checked };
    if (checked) {
      if (!newSettings.accessCode) {
        newSettings.accessCode = generateRandomCode();
        // message.success('已生成默认授权码（需保存）');
      }
    } else {
      newSettings.accessCode = '';
    }
    setLocalSettings(newSettings);
    // message.success('授权码状态已更新（未保存）');
  };

  const generateRandomCode = (len = 6) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  const handleClearAccessCode = () => {
    const newSettings = { ...localSettings, accessCode: '' };
    setLocalSettings(newSettings);
    // message.success('已清除授权码（需保存）');
  };

  // 智能复制
  const copyAll = () => {
    const text =
      localSettings.useAccessCode && localSettings.accessCode
        ? `链接：${link}\n授权码：${localSettings.accessCode}`
        : link;
    navigator.clipboard.writeText(text);
    message.success(
      localSettings.useAccessCode && localSettings.accessCode ? '已复制链接和授权码' : '已复制链接',
    );
  };

  const useLinkExpiryToggle = localSettings.useLinkExpiry;
  const setUseLinkExpiryToggle = (checked) => {
    const newSettings = { ...localSettings, useLinkExpiry: checked };
    if (!checked) newSettings.linkExpiresAt = null;
    setLocalSettings(newSettings);
    message.success('有效期开关已更新（需保存）');
  };

  const applyLinkExpiry = () => {
    if (!useLinkExpiryToggle) return;
    let expiresAt = null;
    if (linkExpiryType === 'custom') {
      if (!linkCustomExpiry) {
        message.error('请选择自定义过期时间');
        return;
      }
      expiresAt = linkCustomExpiry.toISOString();
    } else if (linkExpiryType === 'never') {
      expiresAt = null;
    } else {
      const minutes = parseInt(linkExpiryType, 10);
      expiresAt = dayjs().add(minutes, 'minute').toISOString();
    }
    const newSettings = { ...localSettings, linkExpiresAt: expiresAt };
    setLocalSettings(newSettings);
    message.success(expiresAt ? '有效期已应用（需保存）' : '已设置为永久有效（需保存）');
  };

  const clearLinkExpiry = () => {
    const newSettings = { ...localSettings, useLinkExpiry: false, linkExpiresAt: null };
    setLocalSettings(newSettings);
    message.success('已取消有效期限制（需保存）');
    setLinkExpiryType('never');
    setLinkCustomExpiry(null);
    message.success('已取消有效期限制');
  };

  // 初始化字段权限（仅从 settings 恢复；默认模板由 modal 生成）
  useEffect(() => {
    if (localSettings.fieldPermissions) {
      setFieldPermissions(localSettings.fieldPermissions);
    }
  }, [localSettings.fieldPermissions]);

  const handleSavePermissions = (permissions) => {
    setFieldPermissions(permissions);
    setLocalSettings((ls) => ({ ...ls, fieldPermissions: permissions }));
    message.success('字段权限已更新（需保存）');
  };

  const getPermissionSummary = () => {
    const visibleCount = Object.values(fieldPermissions).filter((p) => p.visible).length;
    const totalCount = Object.keys(fieldPermissions).length;
    if (totalCount === 0) return '未配置';
    return `${visibleCount}/${totalCount} 可显示`;
  };

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size={20}>
        {loading && <Text type="secondary">配置加载中...</Text>}
        <Space align="center" wrap>
          <Text strong>启用公开查询访问</Text>
          <Switch checked={localSettings.isPublic} onChange={handleToggle} />
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            开启后，访问者可通过公开链接查询表单数据。
          </Text>
        </Space>

        {localSettings.isPublic && (
          <>
            <Divider style={{ margin: '12px 0' }} />

            {/* 链接展示区域 */}
            <LinkActionsBar
              link={link}
              useAccessCode={localSettings.useAccessCode}
              accessCode={localSettings.accessCode}
              onCopy={copyAll}
            />

            <Divider style={{ margin: '12px 0' }} />

            {/* 字段展示权限配置 */}
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Space align="center">
                  <Text strong>外链权限配置</Text>
                  <Button type="primary" onClick={() => setShowPermissionModal(true)}>
                    配置可展示字段
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
                      配置用户访问公开查询链接时可以看到的字段
                    </Text>
                    <Text style={{ fontSize: 13 }}>
                      当前配置：<Text strong>{getPermissionSummary()}</Text>
                    </Text>
                  </Space>
                </div>
              </Space>
            </Space>

            <Divider style={{ margin: '12px 0' }} />
            <FillRestrictionsPanel
              localSettings={localSettings}
              accessCodeInput={accessCodeInput}
              setAccessCodeInput={setAccessCodeInput}
              handleAccessCodeToggle={handleAccessCodeToggle}
              handleRefreshAccessCode={(val) => {
                const newCode =
                  typeof val === 'string' && val.trim() ? val.trim() : generateRandomCode();
                const newSettings = { ...localSettings, accessCode: newCode };
                setLocalSettings(newSettings);
                setAccessCodeInput('');
                message.success(
                  typeof val === 'string'
                    ? '授权码已写入本地，点击保存生效'
                    : '已刷新授权码（需保存）',
                );
              }}
              handleClearAccessCode={handleClearAccessCode}
              useLinkExpiryToggle={useLinkExpiryToggle}
              setUseLinkExpiryToggle={setUseLinkExpiryToggle}
              linkExpiryType={linkExpiryType}
              setLinkExpiryType={setLinkExpiryType}
              linkCustomExpiry={linkCustomExpiry}
              setLinkCustomExpiry={setLinkCustomExpiry}
              applyLinkExpiry={applyLinkExpiry}
              clearLinkExpiry={clearLinkExpiry}
              remainingText={remainingText}
              isExpired={isExpired}
            />
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
        showEditable={false}
      />
    </div>
  );
};

export default PublicQueryLink;
