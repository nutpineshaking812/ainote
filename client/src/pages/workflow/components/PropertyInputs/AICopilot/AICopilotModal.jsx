import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { theme, Button, Drawer, Input, Space, Typography, Tooltip, Avatar, Card, message } from 'antd';
import { ThunderboltOutlined, PlayCircleOutlined, CodeOutlined, BugOutlined } from '@ant-design/icons';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';

const { Text, Title } = Typography;

/**
 * Helper to compile the prompt based on values
 */
function compilePromptFromValues(promptText, inputParams, inputSample, outputSample) {
  let text = `请帮我编写一段用于数据提取与转换的 ES6 JavaScript 代码。`;

  if (promptText?.trim()) {
    text += `\n\n【核心业务需求描述】：\n${promptText.trim()}`;
  }

  // Workflow variable params → instruct AI to declare var input = {{param}};
  if (inputParams?.trim()) {
    const tokens = inputParams.trim().match(/{{[^{}]+}}/g);
    if (tokens && tokens.length > 0) {
      const varLines = tokens.map((t) => `var input = ${t};`).join('\n');
      text += `\n\n【输入参数说明】：
用户指定了以下工作流变量作为输入数据来源。
请在代码 **最开头** 用以下方式声明（保留 {{}} 占位符，运行时会被系统自动替换为真实数据）：

${varLines}

声明完毕后，后续所有处理逻辑都基于 \`input\` 变量进行操作。`;
    } else {
      text += `\n\n【输入参数】：${inputParams.trim()}`;
    }
  } else {
    text += `\n\n【输入数据】：数据保存在全局变量 \`input\` 中（对象或数组）`;
  }

  if (inputSample?.trim()) {
    text += `\n\n【input 数据样例（供参考，以了解输入的数据结构）】：\n${inputSample.trim()}`;
  }

  if (outputSample?.trim()) {
    text += `\n\n【期望输出的数据结构/样例】：\n${outputSample.trim()}`;
  }

  text += `

【必须遵循的严格规则】：
1. 直接返回可执行的 JavaScript 代码块，【绝对不要】用 \`\`\`javascript 或 \`\`\` 标记包围代码。
2. 如果有输入参数声明，代码第一行必须是 var input = {{...}}; 的形式（保留双花括号占位符，例如 var input = {{pla_BDHC}};）。除此之外，【绝对不要】在其他任何地方重新声明、定义或初始化名为 \`input\` 的变量。
3. 代码最终必须包含一个 \`return\` 语句来输出结果（如：\`return result;\`）。请直接返回您处理/转换后的原始数据（如数组、对象或基本值均可），底层引擎会自动进行规范的数据包装。
4. 加入 try-catch 异常安全捕获和合理的空值/边界值兜底逻辑，避免字段缺失时报错崩溃。
5. 坚决不要输出任何 HTML、Markdown 标记或任何非 JavaScript 代码的自然语言解释。`;

  return text;
}

/**
 * Reusable, High-Aesthetic Professional Drawer-based Code Sandbox IDE Modal
 */
export const AICopilotModal = ({
  open,
  onCancel,
  isGenerating,
  generatedCode,
  aiMeta = {},
  onAiMetaChange,
  onGenerate,
  onAbort,
  handleApply,
  handleSave,
  // Employee Selection states passed for internal rendering
  employees = [],
  selectedEmployeeId = null,
  setSelectedEmployeeId = () => {},
  // Extensible Customization Props
  title = "AI 协同脚本编辑器",
  promptLabel = "第一步：描述你的转换需求 (描述越清晰，AI 代码越精确)",
  promptPlaceholder = "例如: 将输入数据中的 id 映射为 key，并将 name 映射为 label。最后只保留 status 等于 active 的项...",
  inputSampleLabel = "输入数据样例 (可选，让 AI 学习数据结构)",
  inputSamplePlaceholder = '例如:\n{\n  "status": "active",\n  "createdAt": 1672531199000\n}',
  outputSampleLabel = "期望输出数据样例 (可选，引导 AI 生成符合规范 of 输出)",
  outputSamplePlaceholder = '例如:\n{\n  "status": "active",\n  "date": "2023-01-01 07:59:59"\n}',
  codePreviewLabel = "编辑器源码 (可在此处进行二次修改调试)",
  codePreviewPlaceholder = "等待 AI 协同生成，或直接在此编写代码...",
  applyButtonText = "应用",
  languageExtensions = [javascript()],
}) => {
  const { token } = theme.useToken();
  
  // Local code state to make the editor interactive
  const [editorCode, setEditorCode] = useState('');

  // Local buffer states to avoid cursor jumps and input lag on keystroke parent-render
  const [localInputParams, setLocalInputParams] = useState('');
  const [localPrompt, setLocalPrompt] = useState('');
  const [localInputSample, setLocalInputSample] = useState('');
  const [localOutputSample, setLocalOutputSample] = useState('');

  // Sandbox Console states
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [executionResult, setExecutionResult] = useState(null);
  const [executionError, setExecutionError] = useState(null);

  // Sync initial values only when the drawer is newly opened
  useEffect(() => {
    if (open) {
      setLocalInputParams(aiMeta.inputParams || '');
      setLocalPrompt(aiMeta.prompt || '请帮我编写一段用于数据提取与转换的 ES6 JavaScript 代码。');
      setLocalInputSample(aiMeta.inputSample || '');
      setLocalOutputSample(aiMeta.outputSample || '');
      setEditorCode(generatedCode || '');
      setConsoleLogs([]);
      setExecutionResult(null);
      setExecutionError(null);
    }
  }, [open]);

  // Keep local editor code in sync with streaming generatedCode only during AI generation
  useEffect(() => {
    if (isGenerating && generatedCode !== undefined) {
      setEditorCode(generatedCode || '');
    }
  }, [generatedCode, isGenerating]);

  // Compile prompt dynamically based on the local buffer states
  const compilePrompt = useMemo(() => {
    return compilePromptFromValues(localPrompt, localInputParams, localInputSample, localOutputSample);
  }, [localPrompt, localInputParams, localInputSample, localOutputSample]);

  // Flush all local buffer states back to parent node state in a single batched tick
  const flushLocalStates = useCallback(() => {
    onAiMetaChange?.({
      ...aiMeta,
      inputParams: localInputParams,
      prompt: localPrompt,
      inputSample: localInputSample,
      outputSample: localOutputSample,
    });
  }, [aiMeta, localInputParams, localPrompt, localInputSample, localOutputSample, onAiMetaChange]);

  // Run Test in local Sandboxed Function context
  const handleRunTest = useCallback(() => {
    setConsoleLogs([]);
    setExecutionResult(null);
    setExecutionError(null);

    // Flush current local inputs to parent state as well
    flushLocalStates();

    let parsedInput = {};
    if (localInputSample?.trim()) {
      try {
        parsedInput = JSON.parse(localInputSample.trim());
      } catch (err) {
        setExecutionError(`输入样例 JSON 解析错误: ${err.message}`);
        return;
      }
    }

    const logs = [];
    const customLog = (...args) => {
      const formatted = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try { return JSON.stringify(arg, null, 2); } catch (e) { return String(arg); }
        }
        return String(arg);
      }).join(' ');
      logs.push(formatted);
    };

    const mockConsole = {
      log: customLog,
      info: customLog,
      warn: customLog,
      error: customLog
    };

    try {
      // Replace all workflow placeholders {{variable}} in the code with stringified parsedInput literal
      // This turns 'var input = {{placeholder}};' into valid 'var input = { ... };' rather than buggy self-referential 'var input = input;'
      const inputLiteral = JSON.stringify(parsedInput);
      const runnableCode = editorCode.replace(/{{[^{}]+}}/g, inputLiteral);

      // Create execution sandbox function
      // Context parameters: input (payload), console, log
      const runner = new Function('input', 'console', 'log', `
        try {
          ${runnableCode}
        } catch (innerError) {
          throw innerError;
        }
      `);

      const result = runner(parsedInput, mockConsole, customLog);
      
      // Programmatically guarantee the output is wrapped as { result: ... } for AINote node standard
      let finalResult = result;
      if (result === null || typeof result !== 'object' || !('result' in result)) {
        finalResult = { result: result };
      }
      
      setConsoleLogs(logs);
      setExecutionResult(finalResult);
    } catch (err) {
      setConsoleLogs(logs);
      setExecutionError(err.message);
    }
  }, [editorCode, localInputSample, flushLocalStates]);

  // Premium CodeMirror theme settings
  const customTheme = useMemo(() => EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '13px',
      backgroundColor: token.colorBgContainer,
    },
    '.cm-content': {
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      padding: '12px 0',
    },
    '.cm-line': {
      padding: '0 12px',
      lineHeight: '1.6',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-gutters': {
      backgroundColor: token.colorFillAlter,
      color: token.colorTextDescription,
      borderRight: `1px solid ${token.colorBorderSecondary}`,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    }
  }), [token]);

  const extensions = useMemo(() => [
    ...languageExtensions,
    customTheme,
    EditorView.lineWrapping
  ], [languageExtensions, customTheme]);

  return (
    <Drawer
      title={
        <Space size={8}>
          <ThunderboltOutlined style={{ color: '#722ed1', fontSize: 18 }} />
          <Title level={5} style={{ margin: 0 }}>{title}</Title>
        </Space>
      }
      placement="right"
      width={1050}
      onClose={() => {
        flushLocalStates();
        onCancel();
      }}
      open={open}
      extra={
        <Space>
          <Button onClick={() => {
            flushLocalStates();
            onCancel();
          }}>
            取消
          </Button>
           <Button 
            type="primary" 
            danger={isGenerating}
            onClick={() => {
              if (isGenerating) {
                onAbort();
              } else {
                if (!selectedEmployeeId) {
                  message.warning('请先选择一个 AI 协同助理（数字员工）！');
                  return;
                }
                // Ensure parent state gets updated right before generation
                flushLocalStates();
                onGenerate(compilePrompt);
              }
            }}
          >
            {isGenerating ? '停止生成' : '开始生成'}
          </Button>
          <Button 
            type="primary" 
            disabled={!editorCode || isGenerating}
            onClick={() => {
              flushLocalStates();
              handleApply(editorCode);
              message.success('数据已成功应用至流程节点！');
            }}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            {applyButtonText}
          </Button>
        </Space>
      }
      styles={{
        body: { padding: '16px 24px', background: '#f8fafc' }
      }}
    >
      <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 110px)', overflow: 'hidden' }}>
        
        {/* ================= LEFT COLUMN: AI Assistant & Inputs ================= */}
        <div style={{ width: '42%', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', paddingRight: 4 }} className="no-scrollbar">
          
          {/* AI Helper Avatars */}
          {employees.length > 0 && (
            <Card size="small" title={<Text strong style={{ fontSize: 12 }}>🤖 选择 AI 协同助理</Text>}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto', padding: '4px 0' }} className="no-scrollbar">
                {employees.map((emp) => {
                  const empId = emp._id || emp.id;
                  const isSelected = selectedEmployeeId === empId;
                  return (
                    <Tooltip 
                      key={empId} 
                      title={
                        <div style={{ fontSize: 11, padding: '2px 4px' }}>
                          <strong style={{ display: 'block', marginBottom: 2, fontSize: 12 }}>{emp.name}</strong>
                          <span style={{ color: 'rgba(255,255,255,0.85)', display: 'block' }}>{emp.roleTitle || '开发者'}</span>
                        </div>
                      }
                      mouseEnterDelay={0.2}
                    >
                      <div
                        onClick={() => setSelectedEmployeeId(empId)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          background: isSelected 
                            ? 'linear-gradient(135deg, #722ed1 0%, #1890ff 100%)' 
                            : 'transparent',
                          padding: isSelected ? '1.5px' : '0',
                          boxShadow: isSelected ? '0 2px 6px rgba(114, 46, 209, 0.35)' : 'none',
                          transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                          filter: isSelected ? 'none' : 'grayscale(35%)',
                          opacity: isSelected ? 1 : 0.6
                        }}
                      >
                        <Avatar
                          src={emp.avatar}
                          size={28}
                          style={{
                            backgroundColor: !emp.avatar ? token.colorPrimary : 'transparent',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 'bold',
                            border: '1.5px solid #fff',
                            flexShrink: 0
                          }}
                        >
                          {emp.name?.[0]}
                        </Avatar>
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Simple Structured Prompt Form */}
          <Card size="small" title={<Text strong style={{ fontSize: 12 }}>⚡ 编译规则与核心需求</Text>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              {/* Input Params */}
              <div>
                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>输入参数 (支持 {"{{variable}}"} 语法):</Text>
                <Input 
                  placeholder="如: {{pla_BDHC}}, {{form_list}}"
                  value={localInputParams}
                  onChange={(e) => setLocalInputParams(e.target.value)}
                  disabled={isGenerating}
                />
              </div>

              {/* Requirement Description */}
              <div>
                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>需求描述:</Text>
                <Input.TextArea
                  rows={4}
                  placeholder={promptPlaceholder}
                  value={localPrompt}
                  onChange={(e) => setLocalPrompt(e.target.value)}
                  disabled={isGenerating}
                />
              </div>

            </div>
          </Card>

          {/* Input & Output Data Samples */}
          <Card size="small" title={<Text strong style={{ fontSize: 12 }}>📥 虚拟输入与输出样例数据</Text>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>{inputSampleLabel}</Text>
                <Input.TextArea
                  rows={4}
                  placeholder={inputSamplePlaceholder}
                  style={{ fontFamily: 'monospace', fontSize: 11 }}
                  value={localInputSample}
                  onChange={(e) => setLocalInputSample(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>{outputSampleLabel}</Text>
                <Input.TextArea
                  rows={4}
                  placeholder={outputSamplePlaceholder}
                  style={{ fontFamily: 'monospace', fontSize: 11 }}
                  value={localOutputSample}
                  onChange={(e) => setLocalOutputSample(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
            </div>
          </Card>

        </div>

        {/* ================= RIGHT COLUMN: Interactive Editor & Sandbox Test Console ================= */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'hidden' }}>
          
          {/* Main code editor panel */}
          <Card 
            size="small" 
            title={
              <Space size={6}>
                <CodeOutlined style={{ color: token.colorPrimary }} />
                <Text strong style={{ fontSize: 12 }}>{codePreviewLabel}</Text>
              </Space>
            }
            extra={
              <Button 
                size="small" 
                onClick={() => {
                  navigator.clipboard.writeText(editorCode);
                  message.success('代码已成功复制到剪贴板！');
                }}
                disabled={!editorCode}
                style={{ fontSize: 11 }}
              >
                复制代码
              </Button>
            }
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            styles={{ body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' } }}
          >
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'auto', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
              <CodeMirror
                value={editorCode}
                height="100%"
                width="100%"
                theme="light"
                extensions={extensions}
                onChange={(val) => {
                  setEditorCode(val);
                  handleSave?.(val);
                }}
                placeholder={codePreviewPlaceholder}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: true,
                  highlightActiveLine: true,
                  foldGutter: true,
                }}
              />
              {isGenerating && (
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: 12, 
                    right: 16, 
                    zIndex: 10,
                    background: token.colorPrimaryBg,
                    color: token.colorPrimary,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <ThunderboltOutlined spin /> AI 正在流式编写中...
                </div>
              )}
            </div>
 
            {/* Test action bar */}
            <div style={{ padding: '8px 16px', background: token.colorBgLayout, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: token.colorTextDescription }}>
                编写或生成完成后，可点击右侧运行调试，即时预览输出。
              </span>
              <Button 
                type="primary" 
                icon={<PlayCircleOutlined />} 
                onClick={handleRunTest} 
                disabled={isGenerating}
              >
                运行测试
              </Button>
            </div>
          </Card>

          {/* Sandbox console */}
          <Card 
            size="small" 
            title={
              <Space size={6}>
                <BugOutlined style={{ color: '#eb2f96' }} />
                <Text strong style={{ fontSize: 12 }}>📦 调试沙箱控制台 (Sandbox Console)</Text>
              </Space>
            }
            style={{ height: 230, flexShrink: 0 }}
            styles={{ body: { padding: 10, background: '#1e1e1e', height: '100%', display: 'flex', flexDirection: 'column' } }}
          >
            <div 
              style={{ 
                flex: 1, 
                overflowY: 'auto', 
                fontFamily: 'Consolas, Monaco, monospace', 
                fontSize: '12px',
                color: '#d4d4d4',
                padding: '4px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              {consoleLogs.length === 0 && executionResult === null && executionError === null && (
                <div style={{ color: '#858585', fontStyle: 'italic' }}>
                  控制台为空。点击“运行测试”按钮以模拟执行脚本...
                </div>
              )}

              {/* Logs */}
              {consoleLogs.map((log, index) => (
                <div key={index} style={{ borderBottom: '1px solid #2d2d2d', paddingBottom: 2 }}>
                  <span style={{ color: '#858585', marginRight: 8 }}>[LOG]</span>
                  {log}
                </div>
              ))}

              {/* Success Result */}
              {executionResult !== null && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(82, 196, 26, 0.15)', borderRadius: 4, borderLeft: '3px solid #52c41a' }}>
                  <div style={{ color: '#73d13d', fontWeight: 'bold' }}>Execution Success (返回值):</div>
                  <pre style={{ margin: '4px 0 0 0', color: '#a0d911', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {typeof executionResult === 'object' ? JSON.stringify(executionResult, null, 2) : String(executionResult)}
                  </pre>
                </div>
              )}

              {/* Error Result */}
              {executionError !== null && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(255, 77, 79, 0.15)', borderRadius: 4, borderLeft: '3px solid #ff4d4f' }}>
                  <div style={{ color: '#ff7875', fontWeight: 'bold' }}>Execution Error (脚本执行崩溃):</div>
                  <pre style={{ margin: '4px 0 0 0', color: '#ff9c6e', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {executionError}
                  </pre>
                </div>
              )}
            </div>
          </Card>

        </div>

      </div>
    </Drawer>
  );
};
