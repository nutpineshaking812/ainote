import React from 'react';
import { Input } from 'antd';
import { MAX_BUILDER_WIDTH } from '../../constants.js';

const { TextArea } = Input;

const Builder = ({ field }) => {
  return (
    <div>
      <TextArea
        placeholder={field.properties.placeholder}
        rows={field.properties.rows}
        style={{ pointerEvents: 'none', maxWidth: `${MAX_BUILDER_WIDTH}px` }}
      />
    </div>
  );
};

export default Builder;
