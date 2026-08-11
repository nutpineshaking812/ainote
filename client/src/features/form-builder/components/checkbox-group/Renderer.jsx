import React from 'react';
import { Checkbox, Space } from 'antd';

const Renderer = ({ field, value, onChange, showIndex, fieldIndex, disabled }) => {
  const { options, direction, label } = field.properties;
  const displayText = label;
  const isVertical = direction === 'vertical';
  return (
    <div>
      <Checkbox.Group value={value} onChange={onChange} disabled={disabled}>
        {isVertical ? (
          <Space orientation="vertical" style={{ width: '100%' }}>
            {(options || []).map((opt, index) => (
              <Checkbox key={opt.value} value={opt.value} style={{ lineHeight: '32px' }}>
                {opt.label}
              </Checkbox>
            ))}
          </Space>
        ) : (
          (options || []).map((opt, index) => (
            <Checkbox key={opt.value} value={opt.value}>
              {opt.label}
            </Checkbox>
          ))
        )}
      </Checkbox.Group>
    </div>
  );
};

export default Renderer;
