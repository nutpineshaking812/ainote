import React from 'react';
import { DatePicker } from 'antd';
import { MAX_BUILDER_WIDTH } from '../../constants.js';

const Builder = ({ field }) => {
  return (
    <DatePicker
      placeholder={field.properties.placeholder}
      style={{ width: '100%', pointerEvents: 'none', maxWidth: `${MAX_BUILDER_WIDTH}px` }}
    />
  );
};

export default Builder;
