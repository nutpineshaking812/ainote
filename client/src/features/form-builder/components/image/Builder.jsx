import React from 'react';
import { Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

const Builder = ({ field }) => {
  const properties = field.properties || {};
  const listType = properties.displayMode === 'list' ? 'picture' : 'picture-card';
  const resolvedMaxCountRaw = properties.maxCountEnabled ? properties.maxCount : 1;
  const resolvedMaxCount =
    Number.isFinite(resolvedMaxCountRaw) && resolvedMaxCountRaw > 0
      ? Math.floor(resolvedMaxCountRaw)
      : 1;
  return (
    <Upload
      style={{ pointerEvents: 'none' }}
      listType={listType}
      maxCount={resolvedMaxCount}
      multiple={resolvedMaxCount > 1}
      accept="image/*"
    >
      <Button icon={<UploadOutlined />}>上传</Button>
    </Upload>
  );
};

export default Builder;
