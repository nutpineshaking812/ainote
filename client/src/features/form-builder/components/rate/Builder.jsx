import React from 'react';
import { Rate } from 'antd';

const Builder = ({ field }) => {
  const { label } = field.properties;

  return (
    <div style={{ pointerEvents: 'none' }}>

      <Rate />
    </div>
  );
};

export default Builder;
