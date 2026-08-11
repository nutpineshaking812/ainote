import React from 'react';
import { Table, Input, Select, Button, Space, Checkbox } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Option } = Select;

const ParameterList = ({ value = [], onChange }) => {
  const { t } = useTranslation();

  const handleAddField = () => {
    const newList = [...value, { name: '', type: 'string', description: '', required: false }];
    onChange(newList);
  };

  const handleRemoveField = (index) => {
    const newList = value.filter((_, i) => i !== index);
    onChange(newList);
  };

  const handleUpdateField = (index, field, val) => {
    const newList = value.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: val };
      }
      return item;
    });
    onChange(newList);
  };

  const columns = [
    {
      title: t('workflow.nodes.common.paramName', 'Name'),
      dataIndex: 'name',
      key: 'name',
      width: '25%',
      render: (text, record, index) => (
        <Input
          size="small"
          value={text}
          onChange={(e) => handleUpdateField(index, 'name', e.target.value)}
          placeholder="e.g. city"
        />
      ),
    },
    {
      title: t('workflow.nodes.common.paramType', 'Type'),
      dataIndex: 'type',
      key: 'type',
      width: '20%',
      render: (text, record, index) => (
        <Select
          size="small"
          value={text}
          style={{ width: '100%' }}
          onChange={(val) => handleUpdateField(index, 'type', val)}
        >
          <Option value="string">String</Option>
          <Option value="number">Number</Option>
          <Option value="boolean">Boolean</Option>
          <Option value="object">Object</Option>
          <Option value="array">Array</Option>
        </Select>
      ),
    },
    {
      title: t('workflow.nodes.common.description', 'Desc'),
      dataIndex: 'description',
      key: 'description',
      render: (text, record, index) => (
        <Input
          size="small"
          value={text}
          onChange={(e) => handleUpdateField(index, 'description', e.target.value)}
        />
      ),
    },
    {
      title: t('workflow.nodes.common.required', 'Req'),
      dataIndex: 'required',
      key: 'required',
      width: '10%',
      align: 'center',
      render: (checked, record, index) => (
        <Checkbox
          checked={checked}
          onChange={(e) => handleUpdateField(index, 'required', e.target.checked)}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: '10%',
      render: (_, __, index) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveField(index)}
        />
      ),
    },
  ];

  return (
    <div className="parameter-list-editor">
      <Table
        dataSource={value}
        columns={columns}
        pagination={false}
        size="small"
        rowKey={(record, index) => index}
        bordered
      />
      <Button
        type="dashed"
        onClick={handleAddField}
        block
        icon={<PlusOutlined />}
        style={{ marginTop: 8 }}
      >
        {t('workflow.nodes.common.addParameter', 'Add Parameter')}
      </Button>
    </div>
  );
};

export default ParameterList;
