import React from 'react';
import { Form, Rate } from 'antd';

const RateRenderer = ({ field, value, onChange, disabled }) => {
  return <Rate value={value} onChange={onChange} disabled={disabled} />;
};

export default RateRenderer;
