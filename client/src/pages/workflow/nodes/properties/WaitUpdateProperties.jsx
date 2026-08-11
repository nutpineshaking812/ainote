import React from 'react';
import { Form, Select, InputNumber } from 'antd';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';

const WaitUpdateProperties = ({ node, setNodes, forms = [] }) => {
  const { t } = useTranslation();

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <Form.Item label={t('workflow.designer.form')} name="formId">
        <Select
          options={forms.map((f) => ({ label: f.name, value: f._id }))}
          placeholder="Select Form"
        />
      </Form.Item>
      <Form.Item label={t('workflow.designer.timeout', 'Timeout (seconds)')} name="timeout" initialValue={3600}>
        <InputNumber min={1} style={{ width: '100%' }} />
      </Form.Item>
    </NodePropertyCollapse>
  );
};

export default WaitUpdateProperties;
