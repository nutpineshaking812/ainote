import React, { useState } from 'react';
import { Card, Button, Space, Dropdown } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  EllipsisOutlined,
  StarOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import * as AntdIcons from '@ant-design/icons';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../store/AuthContext';

const AppCard = ({
  app,
  onDelete,
  onEdit,
  isFavorite = false,
  onToggleFavorite,
  loading = false,
}) => {
  const IconComponent = AntdIcons[app.icon] || AntdIcons.FolderOutlined; // Default to FolderOutlined
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasOrgPermission, isAppOwner } = usePermission();
  const [isHovered, setIsHovered] = useState(false);
  const [starred, setStarred] = useState(Boolean(isFavorite));
  const [localLoading, setLocalLoading] = useState(false);

  // keep local starred state in sync if parent updates the prop
  React.useEffect(() => {
    setStarred(Boolean(isFavorite));
  }, [isFavorite]);

  const handleMenuClick = ({ key }) => {
    if (key === 'view') {
      navigate(`/apps/${app._id}`, { state: { appName: app.name } });
    } else if (key === 'edit') {
      onEdit(app);
    } else if (key === 'delete') {
      onDelete(app._id);
    }
  };

  const handleStarClick = async (e) => {
    e.stopPropagation(); // Prevent card click
    if (loading || localLoading) return;

    const newVal = !starred;
    setStarred(newVal);
    setLocalLoading(true);
    try {
      // Notify parent if it wants to refresh its state
      if (onToggleFavorite) await onToggleFavorite(app._id, newVal);
    } catch (err) {
      console.error('Failed to update favorite', err);
      setStarred(!newVal); // rollback
    } finally {
      setLocalLoading(false);
    }
  };

  // Check permissions
  const canEdit = isAppOwner(app, user?.id);
  const canDelete = isAppOwner(app, user?.id) || hasOrgPermission('APP_DELETE');

  // Build menu items based on permissions
  const menuItems = [
    { key: 'view', icon: <EyeOutlined />, label: '查看' },
    canEdit && { key: 'edit', icon: <EditOutlined />, label: '编辑' },
    canDelete && { key: 'delete', icon: <DeleteOutlined />, danger: true, label: '删除' },
  ].filter(Boolean);

  return (
    <Card
      variant={'borderless'}
      style={{
        textAlign: 'center',
        position: 'relative', // For absolute positioning of icons
        boxShadow: isHovered ? '0 2px 6px rgba(16,24,40,0.06)' : '0 2px 6px transparent',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease', // Smooth transition for hover effects
        padding: 0,
        overflow: 'visible',
        width: 160,
        height: 160,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      styles={{ root: { boxShadow: '0 2px 6px transparent' } }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* {isHovered && (
        <div style={{ position: 'absolute', top: '8px', left: '8px', cursor: 'pointer' }} onClick={handleStarClick}>
          <StarOutlined style={{ color: '#888', fontSize: '16px' }} />
        </div>
      )} */}
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 40,
            width: 24,
            height: 24,
            cursor: loading || localLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: loading || localLoading ? 0.6 : 1,
          }}
          onClick={handleStarClick}
        >
          {loading || localLoading ? (
            <AntdIcons.LoadingOutlined style={{ fontSize: 16, color: '#f6c000' }} />
          ) : starred ? (
            <StarOutlined style={{ color: '#f6c000', fontSize: 18 }} />
          ) : (
            <StarOutlined style={{ fontSize: 18 }} />
          )}
        </div>
      )}
      {isHovered && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 40 }}>
          <Dropdown
            menu={{ items: menuItems, onClick: handleMenuClick }}
            trigger={['click']}
            placement="bottomRight"
          >
            <div
              style={{
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <SettingOutlined style={{ color: '#555', fontSize: 16 }} />
            </div>
          </Dropdown>
        </div>
      )}
      <Link
        to={`/apps/${app._id}`}
        state={{ appName: app.name }}
        style={{
          textDecoration: 'none',
          color: 'inherit',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: 12,
          }}
        >
          <div
            style={{
              backgroundColor: app.iconColor || '#1890ff',
              borderRadius: 14,
              width: 78,
              height: 78,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: isHovered
                ? '0 10px 26px rgba(16,24,40,0.14)'
                : '0 6px 12px rgba(16,24,40,0.06)',
              transform: isHovered ? 'translateY(-6px)' : 'none',
              transition: 'all 0.18s ease',
            }}
          >
            <IconComponent style={{ color: '#fff', fontSize: 34 }} />
          </div>
          <div
            style={{
              fontSize: 14,
              marginTop: 6,
              width: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'center',
            }}
          >
            {app.name}
          </div>
        </div>
      </Link>
    </Card>
  );
};

export default AppCard;
