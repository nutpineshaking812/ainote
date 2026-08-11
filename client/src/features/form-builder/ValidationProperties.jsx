import React from 'react';
import { Checkbox, Form, InputNumber, Input, Space, Typography } from 'antd';
const { Text } = Typography;

const ValidationProperties = ({ field, updateField }) => {
  const v = field.validation || {};
  const updateValidation = (patch) => {
    const next = { ...v, ...patch };
    // Clean undefined values to avoid noisy serialization
    Object.keys(next).forEach((k) => {
      if (next[k] === undefined || next[k] === null || next[k] === '') delete next[k];
    });
    updateField(field.id, next, 'validation');
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      <Checkbox
        checked={v.required === true}
        onChange={(e) => updateValidation({ required: e.target.checked })}
      >
        必填
      </Checkbox>
      {field.type === 'number' && (
        <Space size="small">
          <Form.Item label="最小值" style={{ marginBottom: 0 }}>
            <InputNumber
              value={typeof v.min === 'number' ? v.min : undefined}
              onChange={(val) =>
                updateValidation({ min: typeof val === 'number' ? val : undefined })
              }
              placeholder="min"
              style={{ width: 100 }}
            />
          </Form.Item>
          <Form.Item label="最大值" style={{ marginBottom: 0 }}>
            <InputNumber
              value={typeof v.max === 'number' ? v.max : undefined}
              onChange={(val) =>
                updateValidation({ max: typeof val === 'number' ? val : undefined })
              }
              placeholder="max"
              style={{ width: 100 }}
            />
          </Form.Item>
        </Space>
      )}
      {['single-line-text', 'multi-line-text', 'rich-text'].includes(field.type) && (
        <Form.Item label={<Text>正则 Pattern</Text>} tooltip="用于前端校验的正则表达式 (JS)。">
          <Input
            value={typeof v.pattern === 'string' ? v.pattern : ''}
            onChange={(e) => updateValidation({ pattern: e.target.value.trim() || undefined })}
            placeholder="例如 ^[A-Za-z0-9_]+$"
            allowClear
          />
        </Form.Item>
      )}
    </Space>
  );
};

export default ValidationProperties;
