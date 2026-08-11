import React, { useState, useEffect } from 'react';
import { Typography, Input, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

/**
 * A premium "click-to-edit" Title component.
 *
 * @param {string} value - Current title value
 * @param {function} onSave - Callback after editing: (newValue) => Promise<void>
 * @param {number} level - Ant Design Title level (1-5)
 * @param {object} style - Custom styles for the Title/Input
 * @param {boolean} showEditIcon - Whether to show the edit icon on hover
 */
const EditableTitle = ({ value = '', onSave, level = 3, style = {}, showEditIcon = true }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  // Sync with prop changes
  useEffect(() => {
    setTempValue(value);
  }, [value]);

  const handleSave = async () => {
    const trimmed = tempValue?.trim();
    if (!trimmed || trimmed === value) {
      setIsEditing(false);
      setTempValue(value);
      return;
    }

    try {
      await onSave(trimmed);
    } catch (err) {
      console.error('[EditableTitle] Save failed:', err);
      setTempValue(value);
    } finally {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setTempValue(value);
    setIsEditing(false);
  };

  const fontSize = level === 3 ? '24px' : level === 4 ? '20px' : '18px';

  if (isEditing) {
    return (
      <Input
        autoFocus
        variant="borderless"
        value={tempValue}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSave}
        onPressEnter={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleCancel();
        }}
        style={{
          fontSize,
          fontWeight: 700,
          padding: '2px 4px',
          margin: 0,
          color: '#37352f',
          width: '100%',
          // background: '#f7f7f5',
          borderRadius: '4px',
          ...style,
        }}
      />
    );
  }

  return (
    <Title
      level={level}
      style={{
        margin: 0,
        padding: '2px 4px',
        borderRadius: '4px',
        transition: 'all 0.2s ease',
        border: '1px solid transparent',
        display: 'inline-flex',
        alignItems: 'center',
        ...style,
      }}
    >
      {value || t('common.untitled', '未命名')}
      {showEditIcon && (
        <EditOutlined
          onClick={() => setIsEditing(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#37352f';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#bfbfbf';
          }}
          style={{
            fontSize: '14px',
            marginLeft: '8px',
            color: '#bfbfbf',
            opacity: 0.8,
            cursor: 'pointer',
            transition: 'color 0.2s',
          }}
        />
      )}
    </Title>
  );
};

export default EditableTitle;
