import React from 'react';
import { DatePicker } from 'antd';

const Renderer = ({ field, value, onChange, disabled }) => {
  return (
    <DatePicker
      placeholder={field.properties.placeholder}
      style={{ width: '100%' }}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
};

export default Renderer;
