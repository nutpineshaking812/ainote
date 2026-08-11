import React from 'react';
import { Radio, Space } from 'antd';
import { MAX_BUILDER_WIDTH } from '../../constants.js';

const Builder = ({ field }) => {
  const { options, direction, label } = field.properties;
  const displayText = label;
  const isVertical = direction === 'vertical';
  return (
    <div style={{ pointerEvents: 'none', maxWidth: `${MAX_BUILDER_WIDTH}px` }}>
      <Radio.Group>
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

export default Builder;
