import React from 'react';
import { Input } from 'antd';

const { TextArea } = Input;

const Renderer = ({ field, value, onChange, disabled }) => {
  return (
    <TextArea
      placeholder={field.properties.placeholder}
      rows={field.properties.rows}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
};

export default Renderer;
