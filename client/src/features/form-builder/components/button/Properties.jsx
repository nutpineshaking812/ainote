import React from 'react';
import { Form, Input, Select, Typography } from 'antd';

const { Option } = Select;

const Properties = ({ field, updateField }) => {
  const { label, buttonType } = field.properties;

  const handleChange = (key, value) => {
    updateField(field.id, { ...field.properties, [key]: value });
  };

  return (
    <>
      <div
        style={{
          padding: '8px',
          backgroundColor: '#f0f2f5',
          borderRadius: '4px',
          marginBottom: '10px',
        }}
      >
        <Typography.Text copyable={{ text: field.id }}>ID: {field.id}</Typography.Text>
      </div>
      <Form.Item label="按钮文字">
        <Input value={label} onChange={(e) => handleChange('label', e.target.value)} />
      </Form.Item>
      <Form.Item label="按钮类型">
        <Select value={buttonType} onChange={(value) => handleChange('buttonType', value)}>
          <Option value="default">默认</Option>
          <Option value="primary">主要</Option>
          <Option value="dashed">虚线</Option>
          <Option value="text">文本</Option>
          <Option value="link">链接</Option>
        </Select>
      </Form.Item>
    </>
  );
};

export default Properties;
