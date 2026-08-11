import React from 'react';
import { Form, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import SchemaConfigList from './SchemaConfigList';

const DataChangeProperties = ({ node, setNodes, forms = [] }) => {
  const { t } = useTranslation();

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <Form.Item label={t('workflow.designer.form')} name="formId">
        <Select
          options={forms.map((f) => ({ label: f.name, value: f._id }))}
          placeholder="Select Form"
        />
      </Form.Item>
      <Form.Item label={t('workflow.designer.event')} name="event" initialValue="update">
        <Select
          options={[
            { label: 'Create', value: 'create' },
            { label: 'Update', value: 'update' },
            { label: 'Delete', value: 'delete' },
          ]}
        />
      </Form.Item>
      <SchemaConfigList
        mode="input"
        label="输入定义 (Input Schema)"
        node={node}
        setNodes={setNodes}
      />
    </NodePropertyCollapse>
  );
};

export default DataChangeProperties;
