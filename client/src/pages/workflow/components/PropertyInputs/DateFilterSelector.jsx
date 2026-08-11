import React, { useState, useEffect } from 'react';
import { Select, Space } from 'antd';
import VariableInput from './VariableInput';

const PRESETS = [
  { label: '全部', value: '' },
  { label: '今天', value: '今天' },
  { label: '昨天', value: '昨天' },
  { label: '过去 24 小时', value: '1d' },
  { label: '过去 3 天', value: '3d' },
  { label: '过去 7 天', value: '7d' },
  { label: '自定义', value: 'custom' },
];

const DateFilterSelector = ({ value = '', onChange, currentNodeId, placeholder }) => {
  // 判定当前值是否属于已知的预设（非 custom）
  const isPreset = PRESETS.some(p => p.value === value && p.value !== 'custom');
  
  const [selectValue, setSelectValue] = useState(isPreset ? value : (value ? 'custom' : ''));
  const [customValue, setCustomValue] = useState(isPreset ? '' : value);

  useEffect(() => {
    const currentIsPreset = PRESETS.some(p => p.value === value && p.value !== 'custom');
    if (currentIsPreset) {
      setSelectValue(value);
      setCustomValue('');
    } else {
      setSelectValue(value ? 'custom' : '');
      setCustomValue(value || '');
    }
  }, [value]);

  const handleSelectChange = (val) => {
    setSelectValue(val);
    if (val === 'custom') {
      onChange(customValue || '');
    } else {
      onChange(val);
    }
  };

  const handleCustomChange = (val) => {
    setCustomValue(val);
    onChange(val);
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      <Select
        value={selectValue}
        onChange={handleSelectChange}
        options={PRESETS}
        placeholder={placeholder || '请选择日期过滤方式'}
        style={{ width: '100%' }}
      />
      {selectValue === 'custom' && (
        <VariableInput
          value={customValue}
          onChange={handleCustomChange}
          mode="preview"
          rows={1}
          placeholder="请输入相对时间（如 5d）或绑定变量 {{node.date}}"
          currentNodeId={currentNodeId}
          style={{ fontSize: '12px' }}
        />
      )}
    </Space>
  );
};

export default DateFilterSelector;
