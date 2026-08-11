import React from 'react';
import { Form, Input, Typography, Checkbox } from 'antd';
import SectionHeader from '../../SectionHeader.jsx';

const Properties = ({ field, updateField }) => {
  const { label, placeholder } = field.properties;

  const handleChange = (key, value) => {
    updateField(field.id, { ...field.properties, [key]: value });
  };

  const v = field.validation || {};
  const updateValidation = (patch) => {
    const next = { ...v, ...patch };
    Object.keys(next).forEach((k) => {
      if (next[k] === undefined || next[k] === null) delete next[k];
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
      <Form.Item label="提示文字">
        <Input value={placeholder} onChange={(e) => handleChange('placeholder', e.target.value)} />
      </Form.Item>
      <SectionHeader title="校验" />
      <Form.Item>
        <Checkbox
          checked={v.required === true}
          disabled={v.unique === true}
          onChange={(e) => updateValidation({ required: e.target.checked })}
        >
          必填
        </Checkbox>
        <Checkbox
          checked={v.unique === true}
          onChange={(e) => {
            if (e.target.checked) {
              updateValidation({ unique: true, required: true });
            } else {
              updateValidation({ unique: false });
            }
          }}
        >
          唯一
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
