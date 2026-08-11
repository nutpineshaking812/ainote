import React from 'react';
import { InputNumber } from 'antd';

const Renderer = ({ field, value, onChange, disabled }) => {
  return (
    <InputNumber
      placeholder={field.properties.placeholder}
      style={{ width: '100%' }}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
};

export default Renderer;
