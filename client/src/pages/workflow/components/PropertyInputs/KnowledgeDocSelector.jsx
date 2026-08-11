import React, { useState, useEffect, forwardRef, useRef } from 'react';
import { Select, Button, Tooltip } from 'antd';
import { EditOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { listDocuments } from '../../../../api/documents';
import VariableInput from './VariableInput';

/**
 * 静态知识文档多选选择器 - 支持直选列表与变量表达式双模式切换
 */
const KnowledgeDocSelector = forwardRef(
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

    // 模式同步
    useEffect(() => {
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
          // 调用 documents api，过滤 purpose === 'KNOWLEDGE' 的文档
          const res = await listDocuments(appId, { purpose: 'KNOWLEDGE', limit: 1000 });
          const items = res?.items || res || [];
          setOptions(
            items.map((item) => ({
              label: item.title,
              value: `doc:${item.id || item._id}`,
            })),
          );
        } catch (error) {
          console.error('Failed to fetch knowledge documents:', error);
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
      hasManuallyToggled.current = true;
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
              placeholder={placeholder || '请选择知识文档'}
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
              placeholder={placeholder || '如 doc:{{trigger.docId}}'}
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

export default KnowledgeDocSelector;
