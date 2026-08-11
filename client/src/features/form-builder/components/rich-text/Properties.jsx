import React from 'react';
import { Form, Input, Typography, Checkbox, InputNumber } from 'antd';
import SectionHeader from '../../SectionHeader.jsx';

const Properties = ({ field, updateField }) => {
  const { label } = field.properties;

  const handleChange = (key, value) => {
    updateField(field.id, { ...field.properties, [key]: value });
  };

  const v = field.validation || {};
  const updateValidation = (patch) => {
    const next = { ...v, ...patch };
    Object.keys(next).forEach((k) => {
      if (next[k] === undefined || next[k] === null || next[k] === '') delete next[k];
    });
    updateField(field.id, next, 'validation');
  };
  return (
    <>
      <SectionHeader title="属性" />
      <Form.Item label="字段 ID">
        <Input value={field.id} disabled style={{ background: '#fafafa' }} />
      </Form.Item>
      <Form.Item label="标题">
        <Input.TextArea
          value={label}
          onChange={(e) => handleChange('label', e.target.value)}
          rows={3}
        />
      </Form.Item>
      <Form.Item label="行数" tooltip="控制编辑器的高度">
        <InputNumber
          min={1}
          max={50}
          value={field.properties.rows || 5}
          onChange={(val) => handleChange('rows', val)}
          style={{ width: '100%' }}
        />
      </Form.Item>
      <SectionHeader title="校验" />
      <Form.Item>
        <Checkbox
          checked={v.required === true}
          onChange={(e) => updateValidation({ required: e.target.checked })}
        >
          必填
        </Checkbox>
      </Form.Item>
      <Form.Item label="特殊属性">
        <Checkbox
          checked={field.properties.readOnly === true}
          onChange={(e) => handleChange('readOnly', e.target.checked)}
        >
          只读
        </Checkbox>
        <Checkbox
          checked={field.properties.hidden === true}
          onChange={(e) => handleChange('hidden', e.target.checked)}
        >
          隐藏
        </Checkbox>
      </Form.Item>
    </>
  );
};

export default Properties;
