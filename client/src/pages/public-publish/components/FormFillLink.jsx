import React, { useState, useEffect } from 'react';
import { Typography, Space, Switch, Button, message, Divider } from 'antd';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import useExpiryStatus from './useExpiryStatus';
import LinkActionsBar from './LinkActionsBar';
import FillRestrictionsPanel from './FillRestrictionsPanel';
import { getFillConfig, updateFillConfig } from '../../../api/publish';

const { Text } = Typography;

const FormFillLink = ({ formId, link }) => {
  const { appId } = useParams();
  const [loading, setLoading] = useState(true);
  const [localSettings, setLocalSettings] = useState({
    isPublic: false,
    useAccessCode: false,
    accessCode: '',
    useLinkExpiry: false,
    linkExpiresAt: null,
  });
  const [accessCode, setAccessCode] = useState('');
  const [linkExpiryType, setLinkExpiryType] = useState('never');
  const [linkCustomExpiry, setLinkCustomExpiry] = useState(null);
  const { remainingText, isExpired } = useExpiryStatus(localSettings.linkExpiresAt);

  useEffect(() => {
    const load = async () => {
      if (!appId || !formId) return;
      setLoading(true);
      try {
        const cfg = await getFillConfig(appId, formId);
        setLocalSettings((ls) => ({
          ...ls,
          isPublic: !!cfg.isPublic,
          useAccessCode: !!cfg.useAccessCode,
          accessCode: cfg.accessCode || '',
          useLinkExpiry: !!cfg.useLinkExpiry,
          linkExpiresAt: cfg.linkExpiresAt || null,
        }));
      } catch (e) {
        console.error(e);
        message.error('加载表单填写配置失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [appId, formId]);

  const persist = async (patch, successMsg = '已保存') => {
    try {
      await updateFillConfig(appId, formId, {
        isPublic: patch.isPublic,
        useAccessCode: patch.useAccessCode,
        accessCode: patch.accessCode,
        useLinkExpiry: patch.useLinkExpiry,
        linkExpiresAt: patch.linkExpiresAt,
      });
      message.success(successMsg);
    } catch (e) {
      console.error(e);
      message.error('保存失败');
    }
  };

  const generateRandomCode = (len = 6) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  const handleToggle = (checked) => {
    const newSettings = { ...localSettings, isPublic: checked };
    if (!checked) {
      newSettings.useAccessCode = false;
      newSettings.accessCode = '';
      newSettings.useLinkExpiry = false;
      newSettings.linkExpiresAt = null;
    }
    if (!checked) {
      // Turning off: immediately persist (close access + clear related settings)
      setLocalSettings(newSettings);
      persist(newSettings, '已关闭公开访问并保存');
    } else {
      // Turning on: defer persistence until user clicks Save
      setLocalSettings(newSettings);
      message.success('已开启公开访问（需保存）');
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

  const handleClearAccessCode = () => {
    const newSettings = { ...localSettings, accessCode: '' };
    setLocalSettings(newSettings);
    // message.success('已清除授权码（需保存）');
  };

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

  const handleGenerateOrSave = () => {
    const codeToUse = accessCode.trim() || generateRandomCode();
    const newSettings = { ...localSettings, accessCode: codeToUse };
    setLocalSettings(newSettings);
    message.success(
      accessCode.trim() ? '授权码已写入本地，点击保存生效' : '已生成授权码（需保存）',
    );
    setAccessCode('');
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
    setLinkExpiryType('never');
    setLinkCustomExpiry(null);
    message.success('已取消有效期限制（需保存）');
  };

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size={20}>
        {loading && <Text type="secondary">配置加载中...</Text>}
        <Space align="center" wrap>
          <Text strong>启用公开访问</Text>
          <Switch checked={localSettings.isPublic} onChange={handleToggle} />
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            开启后，表单将可通过一个唯一的公开链接被访问。
          </Text>
        </Space>
        {localSettings.isPublic && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <LinkActionsBar
              link={link}
              useAccessCode={localSettings.useAccessCode}
              accessCode={localSettings.accessCode}
              onCopy={copyAll}
            />
            <Divider style={{ margin: '12px 0' }} />
            <FillRestrictionsPanel
              localSettings={localSettings}
              accessCodeInput={accessCode}
              setAccessCodeInput={setAccessCode}
              handleAccessCodeToggle={handleAccessCodeToggle}
              handleRefreshAccessCode={(val) => {
                const newCode =
                  typeof val === 'string' && val.trim() ? val.trim() : generateRandomCode();
                const newSettings = { ...localSettings, accessCode: newCode };
                setLocalSettings(newSettings);
                setAccessCode('');
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
            <Button
              type="primary"
              onClick={() => {
                persist(localSettings);
              }}
            >
              保存
            </Button>
          </>
        )}
      </Space>
    </div>
  );
};

export default FormFillLink;
