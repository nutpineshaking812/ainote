import React from 'react';
import { Breadcrumb, Space, Button, Tooltip, Typography, theme } from 'antd';
import {
  MenuUnfoldOutlined,
  ShareAltOutlined,
  StarOutlined,
  EllipsisOutlined,
  GlobalOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import UserAvatarDropdown from '../../../components/UserAvatarDropdown';

const { Text } = Typography;

/**
 * Notion-style Header for Resource Panels
 */
const ResourcePanelHeader = ({
  breadcrumbItems = [],
  siderCollapsed,
  setSiderCollapsed,
  extraActions,
  lastUpdated,
  isPrivate = true,
  onShare,
  onMore,
  onStar,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  return (
    <div
      className="notion-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '45px',
        padding: '0 12px 0 16px',
        background: 'transparent',
        flexShrink: 0,
        width: '100%',
        zIndex: 100,
      }}
    >
      {/* Left: Breadcrumbs & Sidebar Toggle */}
      <Space size={8} align="center" style={{ minWidth: 0, overflow: 'hidden' }}>
        {siderCollapsed && (
          <Tooltip title={t('common.expandSidebar')}>
            <Button
              size="small"
              type="text"
              icon={
                <MenuUnfoldOutlined style={{ fontSize: '14px', color: token.colorTextSecondary }} />
              }
              onClick={() => setSiderCollapsed?.(false)}
              style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </Tooltip>
        )}

        <Breadcrumb
          items={breadcrumbItems}
          separator={<span style={{ color: token.colorTextDisabled, fontSize: '14px' }}>/</span>}
          style={{
            fontSize: '14px',
            color: token.colorTextHeading,
            whiteSpace: 'nowrap',
          }}
        />

        {isPrivate && (
          <Space size={4} style={{ marginLeft: '4px', opacity: 0.6 }}>
            <LockOutlined style={{ fontSize: '12px', color: token.colorTextSecondary }} />
            <Text style={{ fontSize: '12px', color: token.colorTextSecondary }}>
              {t('common.private') || 'Private'}
            </Text>
          </Space>
        )}
      </Space>

      {/* Right: Meta & Actions */}
      <Space size={12} align="center">
        {lastUpdated && (
          <Text
            type="secondary"
            style={{
              fontSize: '12px',
              color: token.colorTextSecondary,
              marginRight: '4px',
            }}
          >
            {t('common.lastEdited', { time: lastUpdated }) || `Edited ${lastUpdated}`}
          </Text>
        )}

        <Space size={4}>
          {extraActions}

          {onShare && (
            <Button
              type="text"
              size="small"
              icon={
                <ShareAltOutlined style={{ fontSize: '16px', color: token.colorTextHeading }} />
              }
              onClick={onShare}
              style={{ fontSize: '14px', padding: '0 8px', color: token.colorTextHeading }}
            >
              {t('common.share') || 'Share'}
            </Button>
          )}

          {onStar && (
            <Button
              type="text"
              size="small"
              icon={<StarOutlined style={{ fontSize: '16px', color: token.colorTextHeading }} />}
              onClick={onStar}
              style={{ width: '28px', height: '28px' }}
            />
          )}

          {onMore && (
            <Button
              type="text"
              size="small"
              icon={
                <EllipsisOutlined style={{ fontSize: '20px', color: token.colorTextHeading }} />
              }
              onClick={onMore}
              style={{ width: '28px', height: '28px' }}
            />
          )}
        </Space>

        <div style={{ marginLeft: '4px' }}>
          <UserAvatarDropdown />
        </div>
      </Space>
    </div>
  );
};

export default ResourcePanelHeader;
