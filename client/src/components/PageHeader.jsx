import React from 'react';
import { Button, Space, Typography, Breadcrumb, Avatar } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import UserAvatarDropdown from './UserAvatarDropdown';

const { Title } = Typography;

const PageHeader = ({ onBack, title, subTitle, tags, extra, style, showUser = false, breadcrumb, avatar }) => {
  return (
    <div
      style={{
        padding: '12px 24px',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
          {onBack && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
              style={{ fontSize: 16, marginLeft: -12 }}
            />
          )}
          {avatar && (
            <div style={{ marginRight: -4 }}>
              {typeof avatar === 'object' && !React.isValidElement(avatar) ? (
                <Avatar {...avatar} />
              ) : (
                avatar
              )}
            </div>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {breadcrumb ? (
                <div style={{ fontSize: 18, fontWeight: 500 }}>
                  <Breadcrumb {...breadcrumb} />
                </div>
              ) : (
                <Title level={4} style={{ margin: 0, fontSize: 18 }}>
                  {title}
                </Title>
              )}
              {tags && <div>{tags}</div>}
            </div>
            {subTitle && <div style={{ color: '#666', fontSize: 14, marginTop: 4 }}>{subTitle}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {extra && <Space>{extra}</Space>}
          {showUser && <UserAvatarDropdown />}
        </div>
      </div>
    </div>
  );
};



export default PageHeader;
