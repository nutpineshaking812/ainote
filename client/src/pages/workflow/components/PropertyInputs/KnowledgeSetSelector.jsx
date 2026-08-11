import React, { useState, useEffect, forwardRef, useRef } from 'react';
import { Select, Button, Tooltip } from 'antd';
import { EditOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { getKnowledgeSets } from '../../../../api/knowledge-sets';
import VariableInput from './VariableInput';

/**
 * 知识集选择器 - 智能同步版
 * 解决了初始加载时 Manifest 默认值与实际保存值的模式冲突问题
 */
const KnowledgeSetSelector = forwardRef(
  (
    { value, onChange, mode = 'multiple', placeholder, appId, nodes = [], currentNodeId, ...rest },
    ref,
  ) => {
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState([]);

    const isVariable = (val) => typeof val === 'string' && val.includes('{{');

    // 核心状态：模式
    const [inputMode, setInputMode] = useState(() => (isVariable(value) ? 'input' : 'select'));

    // 标记位：是否用户手动操作过切换
    const hasManuallyToggled = useRef(false);

    // 模式同步：当外部 value 发生实质性变化时（例如从 Manifest 默认值变成数据库保存值），自动同步模式
    useEffect(() => {
      // 只有在用户没点过切换按钮的情况下，才根据 value 自动对齐模式
      if (!hasManuallyToggled.current) {
        const targetMode = isVariable(value) ? 'input' : 'select';
        if (targetMode !== inputMode) {
          setInputMode(targetMode);
        }
      }
    }, [value, inputMode]);

    useEffect(() => {
      const fetch = async () => {
        if (inputMode !== 'select' || !appId) return;
        setLoading(true);
        try {
          const data = await getKnowledgeSets({ appId });
          setOptions(
            (data || []).map((item) => ({
              label: item.name,
              value: item.id || item._id,
            })),
          );
        } catch (error) {
          console.error('Failed to fetch knowledge sets:', error);
        } finally {
          setLoading(false);
        }
      };
      fetch();
    }, [inputMode, appId]);

    const getSafeValue = () => {
      if (isVariable(value)) return mode === 'multiple' ? [] : undefined;
      if (mode === 'multiple' && !Array.isArray(value)) return [];
      return value;
    };

    const handleToggle = () => {
      hasManuallyToggled.current = true; // 锁定手动标记
      setInputMode((prev) => (prev === 'select' ? 'input' : 'select'));
    };

    return (
      <div style={{ display: 'flex', gap: 4, width: '100%' }}>
        <div style={{ flex: 1 }}>
          {inputMode === 'select' ? (
            <Select
              ref={ref}
              mode={mode}
              value={getSafeValue()}
              onChange={onChange}
              loading={loading}
              options={options}
              placeholder={placeholder || '请选择知识库'}
              style={{ width: '100%' }}
              showSearch
              allowClear
              optionFilterProp="label"
              {...rest}
            />
          ) : (
            <VariableInput
              ref={ref}
              value={value}
              onChange={onChange}
              nodes={nodes}
              currentNodeId={currentNodeId}
              placeholder={placeholder || '请输入变量'}
              mode="preview"
              style={{ width: '100%' }}
              {...rest}
            />
          )}
        </div>
        <Tooltip title={inputMode === 'select' ? '切换为变量输入' : '切换为列表选择'}>
          <Button
            icon={inputMode === 'select' ? <EditOutlined /> : <UnorderedListOutlined />}
            onClick={handleToggle}
          />
        </Tooltip>
      </div>
    );
  },
);

export default KnowledgeSetSelector;
