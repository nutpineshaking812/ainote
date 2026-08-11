import React from 'react';
import { Form, Input, Button, Space, Checkbox } from 'antd';
import SectionHeader from '../../SectionHeader.jsx';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';

const Properties = ({ field, updateField }) => {
  const { label, rows = [], columns = [] } = field.properties;

  const handleChange = (key, value) => {
    updateField(field.id, { ...field.properties, [key]: value });
  };

  // --- Row Handlers ---
  const handleRowChange = (index, prop, value) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [prop]: value };
    handleChange('rows', newRows);
  };

  const addRow = () => {
    const newRows = [
      ...rows,
      { label: `行${rows.length + 1}`, value: `row${rows.length + 1}` },
    ];
    handleChange('rows', newRows);
  };

  const removeRow = (index) => {
    const newRows = rows.filter((_, i) => i !== index);
    handleChange('rows', newRows);
  };

  // --- Column Handlers ---
  const handleColumnChange = (index, prop, value) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [prop]: value };
    handleChange('columns', newColumns);
  };

  const addColumn = () => {
    const newColumns = [
      ...columns,
      { label: `列${columns.length + 1}`, value: `col${columns.length + 1}` },
    ];
    handleChange('columns', newColumns);
  };

  const removeColumn = (index) => {
    const newColumns = columns.filter((_, i) => i !== index);
    handleChange('columns', newColumns);
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

      <Form.Item label="行选项">
        {rows.map((opt, index) => (
          <Space key={index} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
            <Input
              placeholder="行标签"
              value={opt.label}
              onChange={(e) => handleRowChange(index, 'label', e.target.value)}
            />
            <Input
              placeholder="行值"
              value={opt.value}
              onChange={(e) => handleRowChange(index, 'value', e.target.value)}
            />
            <MinusCircleOutlined onClick={() => removeRow(index)} />
          </Space>
        ))}
        <Button type="dashed" onClick={addRow} block icon={<PlusOutlined />}>
          添加行
        </Button>
      </Form.Item>

      <Form.Item label="列选项">
        {columns.map((opt, index) => (
          <Space key={index} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
            <Input
              placeholder="列标签"
              value={opt.label}
              onChange={(e) => handleColumnChange(index, 'label', e.target.value)}
            />
            <Input
              placeholder="列值"
              value={opt.value}
              onChange={(e) => handleColumnChange(index, 'value', e.target.value)}
            />
            <MinusCircleOutlined onClick={() => removeColumn(index)} />
          </Space>
        ))}
        <Button type="dashed" onClick={addColumn} block icon={<PlusOutlined />}>
          添加列
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
