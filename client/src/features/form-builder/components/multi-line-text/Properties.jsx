import React from 'react';
import { Form, Input, InputNumber, Typography, Checkbox } from 'antd';
import SectionHeader from '../../SectionHeader.jsx';

const MultiLineTextProperties = ({ field, updateField }) => {
  const v = field.validation || {};
  const updateProps = (patch) =>
    updateField(field.id, { ...field.properties, ...patch }, 'properties');
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
          value={field.properties.label}
          onChange={(e) => updateProps({ label: e.target.value })}
          rows={3}
        />
      </Form.Item>
      <Form.Item label="提示文字">
        <Input
          value={field.properties.placeholder}
          onChange={(e) => updateProps({ placeholder: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="行数">
        <InputNumber
          value={field.properties.rows}
          onChange={(value) => updateProps({ rows: value })}
          style={{ width: '100%' }}
        />
      </Form.Item>
      <SectionHeader title="校验" />
      {/* <Form.Item label="正则 Pattern" tooltip="用于前端校验的正则表达式 (JS)。">
        <Input
          value={typeof v.pattern === 'string' ? v.pattern : ''}
          onChange={(e) => updateValidation({ pattern: e.target.value.trim() || undefined })}
          placeholder="例如 ^.{0,200}$"
          allowClear
        />
      </Form.Item> */}
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
          onChange={(e) => updateProps({ readOnly: e.target.checked })}
        >
          只读
        </Checkbox>
        <Checkbox
          checked={field.properties.hidden === true}
          onChange={(e) => updateProps({ hidden: e.target.checked })}
        >
          隐藏
        </Checkbox>
      </Form.Item>
    </>
  );
};

export default MultiLineTextProperties;
