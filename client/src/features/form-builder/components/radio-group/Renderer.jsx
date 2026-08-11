import React from 'react';
import { Radio, Space } from 'antd';

const Renderer = ({ field, value, onChange, showIndex, fieldIndex, disabled }) => {
  const { options, direction, label } = field.properties;
  const displayText = label;
  const isVertical = direction === 'vertical';
  return (
    <div>
      <Radio.Group value={value} onChange={onChange} disabled={disabled}>
        {isVertical ? (
          <Space orientation="vertical" style={{ width: '100%' }}>
            {(options || []).map((opt, index) => (
              <Radio key={opt.value} value={opt.value} style={{ lineHeight: '32px' }}>
                {opt.label}
              </Radio>
            ))}
          </Space>
        ) : (
          (options || []).map((opt, index) => (
            <Radio key={opt.value} value={opt.value}>
              {opt.label}
            </Radio>
          ))
        )}
      </Radio.Group>
    </div>
  );
};

export default Renderer;
