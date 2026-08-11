import React from 'react';
import { Button } from 'antd';

const Builder = ({ field }) => {
  return (
    <Button type={field.properties.buttonType} style={{ pointerEvents: 'none' }}>
      {field.properties.label}
    </Button>
  );
};

export default Builder;
