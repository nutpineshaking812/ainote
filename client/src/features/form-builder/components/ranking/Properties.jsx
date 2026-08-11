import React from 'react';
import { Form, Input, Button, Space, Checkbox } from 'antd';
import SectionHeader from '../../SectionHeader.jsx';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';

const Properties = ({ field, updateField }) => {
  const { label, options } = field.properties;

  const handleChange = (key, value) => {
    updateField(field.id, { ...field.properties, [key]: value });
  };

  const handleOptionChange = (index, prop, value) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [prop]: value };
    handleChange('options', newOptions);
  };

  const addOption = () => {
    const newOptions = [
      ...(options || []),
      { label: `选项${(options?.length || 0) + 1}`, value: `option${(options?.length || 0) + 1}` },
    ];
    handleChange('options', newOptions);
  };

  const removeOption = (index) => {
    const newOptions = options.filter((_, i) => i !== index);
    handleChange('options', newOptions);
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

      <Form.Item label="选项">
        {(options || []).map((opt, index) => (
          <Space key={index} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
            <Input
              placeholder="选项名"
              value={opt.label}
              onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
            />
            <Input
              placeholder="选项值"
              value={opt.value}
              onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
            />
            <MinusCircleOutlined onClick={() => removeOption(index)} />
          </Space>
        ))}
        <Button type="dashed" onClick={addOption} block icon={<PlusOutlined />}>
          添加选项
        </Button>
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
    </>
  );
};

export default Properties;
