import React from 'react';
import { Form, Checkbox, Select, Input } from 'antd';
import SectionHeader from '../../SectionHeader.jsx';

const TextInputProperties = ({ field, updateField }) => {
  const v = field.validation || {};
  const updateProps = (patch) => {
    updateField(field.id, { ...field.properties, ...patch }, 'properties');
  };
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
      <SectionHeader title="校验" />
      <Form.Item label="格式校验" tooltip="选择常用格式。自定义可在代码中扩展。">
        <Select
          value={typeof v.pattern === 'string' ? v.pattern : undefined}
          onChange={(value) => updateValidation({ pattern: value || undefined })}
          allowClear
          placeholder="请选择常用格式"
          options={[
            { label: '无', value: undefined },
            { label: '手机', value: '^1[3-9]\\d{9}$' },
            { label: '电话', value: '^(0\\d{2,3}-?)?\\d{7,8}$' },
            { label: '邮政编码', value: '^\\d{6}$' },
            {
              label: '身份证号',
              value:
                '^[1-9]\\d{5}(18|19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[0-9Xx]$',
            },
            { label: '邮箱', value: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' },
          ]}
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

export default TextInputProperties;
