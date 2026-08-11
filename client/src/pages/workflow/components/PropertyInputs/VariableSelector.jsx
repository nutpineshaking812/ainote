import React, { useState } from 'react';
import { Button, Popover, List, Typography, Tooltip, message } from 'antd';
import { FunctionOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const VariableSelector = ({ variables = [], onSelect }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleCopy = (value) => {
    // navigator.clipboard.writeText(value);
    // message.success(t('common.copied', 'Copied to clipboard'));
    setOpen(false);
    if (onSelect) {
      onSelect(value);
    }
  };

  const content = (
    <div style={{ width: 300, maxHeight: 400, overflow: 'auto' }}>
      <List
        size="small"
        dataSource={variables}
        renderItem={(item) => (
          <List.Item
            className="variable-item"
            onClick={() => handleCopy(item.value)}
            style={{ cursor: 'pointer', padding: '8px 12px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 13 }}>{item.label}</Text>
                <CopyOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
              </div>
              <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>
                {item.value}
              </Text>
              {item.description && (
                 <Text type="secondary" style={{ fontSize: 11, marginTop: 2 }}>
                   {item.description}
                 </Text>
              )}
            </div>
          </List.Item>
        )}
      />
      {variables.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: '#8c8c8c' }}>
          {t('workflow.designer.noVariables', 'No variables available')}
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      title={t('workflow.designer.insertVariable', 'Insert Variable')}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
    >
      <Tooltip title={t('workflow.designer.insertVariable', 'Insert Variable')}>
        <Button 
          type="text" 
          size="small" 
          icon={<FunctionOutlined style={{ fontSize: 14, color: '#1677ff' }} />} 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: '#e6f4ff', 
            borderColor: '#e6f4ff',
            width: 24,
            height: 24
          }}
        />
      </Tooltip>
    </Popover>
  );
};

export default VariableSelector;
