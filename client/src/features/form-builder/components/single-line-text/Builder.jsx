import React from 'react';
import { Input } from 'antd';

import { MAX_BUILDER_WIDTH } from '../../constants.js';

const Builder = ({ field }) => {
  return (
    <Input
      placeholder={field.properties.placeholder}
      style={{ pointerEvents: 'none', maxWidth: `${MAX_BUILDER_WIDTH}px` }}
    />
  );
};

export default Builder;
