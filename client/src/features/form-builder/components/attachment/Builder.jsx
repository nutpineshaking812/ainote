import React from 'react';
import { Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

const Builder = ({ field }) => {
  return (
    <Upload style={{ pointerEvents: 'none' }}>
      <Button icon={<UploadOutlined />}>点击上传</Button>
    </Upload>
  );
};

export default Builder;
