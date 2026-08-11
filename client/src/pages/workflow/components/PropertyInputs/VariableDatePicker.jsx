import React, { useCallback, useMemo } from 'react';
import { DatePicker, Tooltip, Button } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import VariableInput from './VariableInput';
import dayjs from 'dayjs';

const VariableDatePicker = ({ value, onChange, nodes = [], currentNodeId, placeholder, ...props }) => {
  const handleDateChange = useCallback((date) => {
    if (date && onChange) {
      // Use format() to keep local time instead of toISOString() which forces UTC
      onChange(date.format('YYYY-MM-DD HH:mm:ss'));
    }
  }, [onChange]);

  const dateValue = useMemo(() => {
    if (!value) return null;
    const d = dayjs(value);
    return d.isValid() ? d : null;
  }, [value]);

  const betterDatePickerAction = useMemo(() => (
    <div 
      style={{ position: 'relative', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => e.stopPropagation()} // Prevent bubbling to parent elements
    >
      <CalendarOutlined style={{ fontSize: 14, color: '#13c2c2' }} />
      <DatePicker
        showTime
        value={dateValue}
        onChange={handleDateChange}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          padding: 0
        }}
        suffixIcon={null}
        allowClear={false}
      />
    </div>
  ), [handleDateChange, dateValue]);

  return (
    <VariableInput
      value={value}
      onChange={onChange}
      nodes={nodes}
      currentNodeId={currentNodeId}
      placeholder={placeholder}
      extra={betterDatePickerAction}
      {...props}
    />
  );
};

export default VariableDatePicker;
