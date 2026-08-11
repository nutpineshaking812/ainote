import React from 'react';
import { Space, Badge } from 'antd';
import InlineEditableTitle from '../../../../components/InlineEditableTitle';

export default function DocumentHeaderTitle({ title, activeDoc, onChange, dirty, saving }) {
  return (
    <Space>
      <InlineEditableTitle
        value={title || activeDoc?.title}
        defaultValue="新建文档"
        onChange={onChange}
      />
      {dirty && (
        <Badge
          status="warning"
          text={<span style={{ fontSize: 12, color: '#faad14' }}>未保存</span>}
        />
      )}
      {saving && (
        <Badge
          status="processing"
          text={<span style={{ fontSize: 12, color: '#1890ff' }}>保存中...</span>}
        />
      )}
    </Space>
  );
}
