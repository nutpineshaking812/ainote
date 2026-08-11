import React from 'react';
import { Segmented, Form } from 'antd';

const LayoutProperties = ({ field, updateField }) => {
  const spanToValueMap = {
    6: '1/4',
    8: '1/3',
    12: '1/2',
    16: '2/3',
    18: '3/4',
    24: '整行',
  };

  const valueToSpanMap = {
    '1/4': 6,
    '1/3': 8,
    '1/2': 12,
    '2/3': 16,
    '3/4': 18,
    整行: 24,
  };

  const handleWidthChange = (value) => {
    const newSpan = valueToSpanMap[value] || 24;
    updateField(field.id, { ...field.layout, span: newSpan });
  };

  const currentSpan = field.layout?.span || 24;
  const currentValue = spanToValueMap[currentSpan] || '整行';

  return (
    <Form.Item>
      <Segmented
        options={['1/4', '1/3', '1/2', '2/3', '3/4', '整行']}
        value={currentValue}
        onChange={handleWidthChange}
      />
    </Form.Item>
  );
};

export default LayoutProperties;
