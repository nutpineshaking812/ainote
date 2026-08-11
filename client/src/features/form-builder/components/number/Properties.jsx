import React from 'react';
import { Form, Input, InputNumber, Typography, Checkbox } from 'antd';
import SectionHeader from '../../SectionHeader.jsx';

const Properties = ({ field, updateField }) => {
  const { label, placeholder } = field.properties;
  const v = field.validation || {};

  const updateProps = (patch) => {
    updateField(field.id, { ...field.properties, ...patch }, 'properties');
  };
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
          onChange={(e) => updateProps({ label: e.target.value })}
          rows={3}
        />
      </Form.Item>
      <Form.Item label="提示文字">
        <Input value={placeholder} onChange={(e) => updateProps({ placeholder: e.target.value })} />
      </Form.Item>
      <SectionHeader title="校验" />
      <Form.Item label="数值范围">
        <InputNumber
          placeholder="最小值"
          value={typeof v.min === 'number' ? v.min : undefined}
          onChange={(val) => updateValidation({ min: typeof val === 'number' ? val : undefined })}
          style={{ width: '45%', marginRight: '10%' }}
        />
        <InputNumber
          placeholder="最大值"
          value={typeof v.max === 'number' ? v.max : undefined}
          onChange={(val) => updateValidation({ max: typeof val === 'number' ? val : undefined })}
          style={{ width: '45%' }}
        />
      </Form.Item>
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

export default Properties;
