import React from 'react';
import { Input } from 'antd';

const Renderer = ({ field, value, onChange, disabled }) => {
  return (
    <Input
      placeholder={field.properties.placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
};

export default Renderer;
