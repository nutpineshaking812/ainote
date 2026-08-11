import React from 'react';
import { Typography } from 'antd';

// A subtle, aesthetic section header replacing Dividers.
// Usage: <SectionHeader title="属性" />
export const SectionHeader = ({ title, extra }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        margin: '16px 0 8px',
        //   padding: '4px 8px',
        borderRadius: 6,
        //   background: 'linear-gradient(90deg, #f7f9fc, #f0f3f8)',
        //   border: '1px solid #e5e9ef'
      }}
    >
      <Typography.Text style={{ fontWeight: 600, color: '#314659', letterSpacing: '0.5px' }}>
        {title}
      </Typography.Text>
      {extra && <div style={{ marginLeft: 'auto' }}>{extra}</div>}
    </div>
  );
};

export default SectionHeader;
