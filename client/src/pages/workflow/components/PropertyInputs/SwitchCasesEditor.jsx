import React from 'react';
import { Button, Select, Space, Row, Col, Typography, Card } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import VariableInput from './VariableInput';

const { Text } = Typography;

const OPERATORS = [
  { value: 'equals', label: '等于 (=)' },
  { value: 'not_equals', label: '不等于 (!=)' },
  { value: 'contains', label: '包含' },
  { value: 'not_contains', label: '不包含' },
  { value: 'starts_with', label: '开头是' },
  { value: 'ends_with', label: '结尾是' },
  { value: 'regex', label: '正则匹配' },
  { value: 'greater_than', label: '大于 (>)' },
  { value: 'less_than', label: '小于 (<)' },
  { value: 'greater_equal', label: '大于等于 (>=)' },
  { value: 'less_equal', label: '小于等于 (<=)' },
  { value: 'is_empty', label: '为空' },
  { value: 'is_not_empty', label: '不为空' },
  { value: 'custom', label: '自定义 JS' },
];

const SwitchCasesEditor = ({ value = [], onChange, currentNodeId, setNodes, node }) => {
  // Ensure we have an array to iterate over
  const cases = Array.isArray(value) ? value : [];

  const triggerChange = (newCases) => {
    if (onChange) {
      onChange(newCases);
    }

    // Proactively sync cases to node.data.outputs if setNodes is available
    if (setNodes && node?.id) {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            // Map each case to an output definition so downstream can reference it
            const outputs = [
              { name: 'expression', type: 'string', label: '判定表达式' },
              { name: 'matchedCase', type: 'string', label: '匹配成功的分支' },
              ...newCases.map((c, index) => ({
                name: c.handle || `branch_${index + 1}`,
                type: 'boolean',
                label: `分支: ${c.value || `条件 ${index + 1}`}`,
              })),
            ];
            return {
              ...n,
              data: {
                ...n.data,
                outputs,
              },
            };
          }
          return n;
        })
      );
    }
  };

  const handleAdd = () => {
    const nextIndex = cases.length + 1;
    const newCase = {
      handle: `branch_${nextIndex}`,
      operator: 'equals',
      value: '',
      caseSensitive: false,
    };
    triggerChange([...cases, newCase]);
  };

  const handleRemove = (index) => {
    const updated = cases.filter((_, i) => i !== index);
    // Re-index remaining branches so handle IDs remain perfectly sequential and stable
    const reindexed = updated.map((c, i) => ({
      ...c,
      handle: `branch_${i + 1}`,
    }));
    triggerChange(reindexed);
  };

  const handleFieldChange = (index, field, val) => {
    const updated = cases.map((c, i) => {
      if (i === index) {
        return { ...c, [field]: val };
      }
      return c;
    });
    triggerChange(updated);
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {cases.map((c, index) => {
        const showValueField = c.operator !== 'is_empty' && c.operator !== 'is_not_empty';
        return (
          <Card
            key={index}
            size="small"
            style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8 }}
            bodyStyle={{ padding: 10 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Row 1: Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 12, color: '#faad14' }}>
                  条件分支 {index + 1}
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    出口:
                  </Text>
                  <Text code style={{ fontSize: 10 }}>
                    {c.handle || `branch_${index + 1}`}
                  </Text>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                    onClick={() => handleRemove(index)}
                  />
                </div>
              </div>

              {/* Row 2: Operator & Value */}
              <Row gutter={8} align="middle">
                <Col span={10}>
                  <Select
                    size="small"
                    options={OPERATORS}
                    value={c.operator || 'equals'}
                    onChange={(val) => handleFieldChange(index, 'operator', val)}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={14}>
                  {showValueField && (
                    <VariableInput
                      size="small"
                      placeholder={
                        c.operator === 'custom'
                          ? '输入 JS 表达式'
                          : '比较值/变量'
                      }
                      value={c.value}
                      onChange={(val) => handleFieldChange(index, 'value', val)}
                      currentNodeId={currentNodeId}
                    />
                  )}
                </Col>
              </Row>
            </div>
          </Card>
        );
      })}

      <Button
        type="dashed"
        block
        size="small"
        icon={<PlusOutlined />}
        onClick={handleAdd}
        style={{ borderRadius: 6 }}
      >
        添加匹配分支
      </Button>

      {/* Default Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '0 4px', color: '#8c8c8c' }}>
        <span>其余情况默认走向:</span>
        <Text code style={{ fontSize: 10 }}>default</Text>
      </div>
    </Space>
  );
};

export default SwitchCasesEditor;
