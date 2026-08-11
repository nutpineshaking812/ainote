import React, { useCallback } from 'react';
import {
  Button, Input, Avatar, Tooltip, theme, Typography, Tag,
} from 'antd';
import {
  ThunderboltOutlined, CloseOutlined, RobotOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * Inline AI Generator panel — fully controlled.
 * aiMeta: { inputParams, inputSample, outputSample }
 * onAiMetaChange: (patch) => void  — merges patch into aiMeta
 */
export function InlineAIGenerator({
  employees = [],
  selectedId,
  isGenerating,
  onGenerate,
  onAbort,
  onClose,
  // controlled state (persisted in node)
  aiMeta = {},
  onAiMetaChange,
}) {
  const { token } = theme.useToken();

  const inputParams  = aiMeta.inputParams  || '';
  const inputSample  = aiMeta.inputSample  || '';
  const outputSample = aiMeta.outputSample || '';

  const patch = useCallback((key, val) => {
    onAiMetaChange?.({ ...aiMeta, [key]: val });
  }, [aiMeta, onAiMetaChange]);

  const handleGenerate = useCallback(() => {
    const prompt = buildPrompt(inputParams, inputSample, outputSample);
    if (prompt) onGenerate(prompt);
  }, [inputParams, inputSample, outputSample, onGenerate]);

  const selectedEmployee = employees.find((e) => (e._id || e.id) === selectedId);

  // Extract variable references like {{pla_BDHC}} from the inputParams string
  const varMatches = [...new Set((inputParams.match(/{{[^{}]+}}/g) || []))];


  return (
    <div
      style={{
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillAlter,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Header row — title, employee, action button, close */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <ThunderboltOutlined style={{ color: token.colorPrimary, fontSize: 13, flexShrink: 0 }} />
          <Text strong style={{ fontSize: 12, color: token.colorText, flexShrink: 0 }}>AI 快速生成</Text>
          {selectedEmployee && (
            <Tooltip title={`${selectedEmployee.name}${selectedEmployee.roleTitle ? ' · ' + selectedEmployee.roleTitle : ''}`}>
              <Avatar
                src={selectedEmployee.avatar}
                size={20}
                style={{
                  backgroundColor: !selectedEmployee.avatar ? token.colorPrimary : 'transparent',
                  cursor: 'default',
                  flexShrink: 0,
                }}
              >
                {!selectedEmployee.avatar && (selectedEmployee.name?.[0] || <RobotOutlined />)}
              </Avatar>
            </Tooltip>
          )}
          {employees.length === 0 && (
            <Text type="secondary" style={{ fontSize: 11 }}>（未配置 AI 技术专家）</Text>
          )}
        </div>

        {/* Action button in the header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isGenerating ? (
            <Button size="small" danger icon={<CloseOutlined />} onClick={onAbort}>
              停止
            </Button>
          ) : (
            <Button
              size="small"
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleGenerate}
              disabled={employees.length === 0}
            >
              生成
            </Button>
          )}
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={onClose}
            style={{ color: token.colorTextQuaternary }}
          />
        </div>
      </div>

      {/* Input parameters — workflow variable references */}
      <div>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
          输入参数（填写工作流变量，如 <code style={{ fontSize: 10 }}>{'{{pla_BDHC}}'}</code>，多个用逗号分隔）
        </Text>
        <Input
          size="small"
          placeholder="如：{{pla_BDHC}}, {{form_name}}, {{order_list}}"
          value={inputParams}
          onChange={(e) => patch('inputParams', e.target.value)}
          disabled={isGenerating}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
        {/* Live preview of detected variable tokens */}
        {varMatches.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
            {varMatches.map((v) => (
              <Tag
                key={v}
                color="processing"
                style={{ fontSize: 10, padding: '0 5px', margin: 0, fontFamily: 'monospace' }}
              >
                {v}
              </Tag>
            ))}
          </div>
        )}
      </div>

      {/* Input / Output samples side by side */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            输入数据样例（JSON 格式，可选）
          </Text>
          <Input.TextArea
            size="small"
            rows={3}
            placeholder={'{\n  "id": 1,\n  "name": "Alice"\n}'}
            style={{ fontFamily: 'monospace', fontSize: 11, resize: 'none' }}
            value={inputSample}
            onChange={(e) => patch('inputSample', e.target.value)}
            disabled={isGenerating}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            期望输出样例（JSON 格式，可选）
          </Text>
          <Input.TextArea
            size="small"
            rows={3}
            placeholder={'{\n  "key": 1,\n  "label": "Alice"\n}'}
            style={{ fontFamily: 'monospace', fontSize: 11, resize: 'none' }}
            value={outputSample}
            onChange={(e) => patch('outputSample', e.target.value)}
            disabled={isGenerating}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Builds the structured prompt.
 */
function buildPrompt(inputParams, inputSample, outputSample) {
  let text = `请帮我编写一段用于数据提取与转换的 ES6 JavaScript 代码。`;

  // Workflow variable params → instruct AI to declare var input = {{param}};
  if (inputParams?.trim()) {
    // Extract all {{...}} tokens, fallback to raw text if none found
    const tokens = inputParams.trim().match(/{{[^{}]+}}/g);
    if (tokens && tokens.length > 0) {
      const varLines = tokens.map((t) => `var input = ${t};`).join('\n');
      text += `\n\n【输入参数说明】：
用户指定了以下工作流变量作为输入数据来源。
请在代码 **最开头** 用以下方式声明（保留 {{}} 占位符，运行时会被系统自动替换为真实数据）：

${varLines}

声明完毕后，后续所有处理逻辑都基于 \`input\` 变量进行操作。`;
    } else {
      // User typed free text without {{}} syntax
      text += `\n\n【输入参数】：${inputParams.trim()}`;
    }
  } else {
    text += `\n\n【输入】：数据保存在全局变量 \`input\` 中（对象或数组）`;
  }

  // Input data sample
  if (inputSample?.trim()) {
    text += `\n\n【input 数据样例（供参考，了解数据结构）】：\n${inputSample.trim()}`;
  }

  // Expected output
  if (outputSample?.trim()) {
    text += `\n\n【期望输出的数据结构/样例】：\n${outputSample.trim()}`;
  }

  text += `

【必须遵循的严格规则】：
1. 直接返回可执行的 JavaScript 代码块，【绝对不要】用 \`\`\`javascript 或 \`\`\` 标记包围代码。
2. 如果有输入参数声明，代码第一行必须是 var input = {{...}}; 的形式（保留双花括号占位符）。
3. 代码最终需要包含一个 \`return\` 语句（如：\`return result;\`）来输出转换后的数据。
4. 加入 try-catch 异常安全捕获和合理的空值/边界值兜底逻辑，避免字段缺失时报错崩溃。
5. 坚决不要输出任何 HTML、Markdown 标记或任何非 JavaScript 代码的自然语言解释。`;

  return text;
}

export default InlineAIGenerator;
