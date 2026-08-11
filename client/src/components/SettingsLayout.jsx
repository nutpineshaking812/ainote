import React, { useState } from 'react';
import { Layout, Menu, Space, Typography, Button } from 'antd';
import { LeftOutlined, RightOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOrg } from '../store/OrgContext';
import UserAvatarDropdown from './UserAvatarDropdown';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

/**
 * 可复用的设置页面布局组件
 *
 * @param {Object} props
 * @param {string} props.title - 页面标题
 * @param {React.ReactNode} props.titleIcon - 标题图标
 * @param {string} props.iconColor - 图标背景色
 * @param {Array} props.menuItems - 菜单项配置
 * @param {string} props.backPath - 返回路径
 * @param {React.ReactNode} props.children - 子内容（如果不使用 Outlet）
 * @param {boolean} props.useOutlet - 是否使用 Outlet（默认 true）
 * @param {Array} props.defaultOpenKeys - 默认展开的菜单项
 */
const SettingsLayout = ({
  title,
  titleIcon,
  iconColor = '#00b96b',
  menuItems = [],
  backPath = '/',
  children,
  useOutlet = true,
  defaultOpenKeys = [],
  showHeader = true,
  activeKey,
  onMenuClick,
  collapsible = true,
}) => {
  const { t } = useTranslation();
  const { currentOrganization } = useOrg();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleMenuClick = (e) => {
    if (onMenuClick) {
      onMenuClick(e);
    } else {
      navigate(e.key);
    }
  };

  const resolvedActiveKey = activeKey || location.pathname;
  const topOffset = showHeader ? 56 : 0;

  return (
    <Layout
      style={{ height: showHeader ? '100vh' : '100%', background: '#fff', overflow: 'hidden' }}
    >
      {showHeader && (
        <Header
          style={{
            background: '#fff',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            height: 56,
            lineHeight: '56px',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <Space size={16}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
              }}
              onClick={() => navigate(backPath)}
            >
              <ArrowLeftOutlined style={{ fontSize: 18, color: iconColor, marginRight: 12 }} />
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: currentOrganization?.logo ? 'transparent' : iconColor,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                  overflow: 'hidden',
                }}
              >
                {currentOrganization?.logo ? (
                  <img
                    src={currentOrganization.logo}
                    alt="Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  titleIcon
                )}
              </div>
              <Title level={5} style={{ margin: 0, fontSize: 16 }}>
                {title}
              </Title>
            </div>
          </Space>
          <Space size={20}>
            <UserAvatarDropdown />
          </Space>
        </Header>
      )}

      <Layout>
        <Sider
          width={240}
          theme="light"
          collapsible={collapsible}
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
          style={{
            borderRight: '1px solid #f0f0f0',
            overflow: 'auto',
            bottom: 0,
            backgroundColor: '#fafafa',
          }}
          trigger={collapsed ? <RightOutlined /> : <LeftOutlined />}
        >
          <Menu
            mode="inline"
            selectedKeys={[resolvedActiveKey]}
            style={{ height: '100%', borderRight: 0, paddingTop: 12, background: 'transparent' }}
            items={menuItems}
            onClick={handleMenuClick}
            defaultOpenKeys={defaultOpenKeys}
          />
        </Sider>

        <Layout
          style={{
            transition: 'all 0.2s',
            height: showHeader ? `calc(100vh - ${topOffset}px)` : '100%',
            overflow: 'hidden',
          }}
        >
          <Content
            style={{
              padding: 0,
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
            }}
          >
            {useOutlet ? <Outlet /> : children}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default SettingsLayout;
