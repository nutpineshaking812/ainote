import React, { useEffect, useState } from 'react';
import { CodeHighlighter } from '@ant-design/x';
import mermaid from 'mermaid';
import beautify from 'js-beautify';

// ==========================================
// 1. 初始化 Mermaid 渲染器
// ==========================================
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

let mermaidIdCounter = 0;

function Mermaid({ children }: { children: string }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const code = children || '';
    if (!code.trim()) {
      setSvg('');
      setError(null);
      return;
    }
    let cancelled = false;
    const currentId = `mermaid-render-${++mermaidIdCounter}`;

    const renderGraph = async () => {
      try {
        const { svg: renderedSvg } = await mermaid.render(currentId, code);
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    renderGraph();

    return () => {
      cancelled = true;
    };
  }, [children]);

  if (error) {
    return (
      <div
        style={{
          padding: '12px 16px',
          background: '#fff1f2',
          border: '1px solid #fecdd3',
          borderRadius: 8,
          fontSize: 12,
          color: '#be123c',
          fontFamily: 'Consolas, Monaco, monospace',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <b>⚠️ Mermaid 语法错误（继续输入以自动恢复）</b>
        <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {error.message}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return <div style={{ color: '#94a3b8', fontSize: 13 }}>正在渲染图表...</div>;
  }

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}

// ==========================================
// 2. 支持的编程语言
// ==========================================
export const LANGUAGES = [
  { value: 'mermaid', label: 'Mermaid' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash/Shell' },
];

// ==========================================
// 3. 读取 BlockContent 文字的纯函数工具
// ==========================================
export const getBlockText = (b: any) => {
  if (!b.content) return '';
  if (typeof b.content === 'string') return b.content;
  if (Array.isArray(b.content)) {
    return b.content.map((node: any) => node.text || '').join('');
  }
  return '';
};

// ==========================================
// 3.5 纯本地轻量化代码格式化工具 (Zero Dependencies)
// ==========================================
const formatCurl = (curl: string): string => {
  // 1. Clean up backslashes and collapse multiple spaces/newlines
  let cleaned = curl.replace(/\\\s*\n/g, ' ').replace(/\s+/g, ' ').trim();
  
  // 2. Tokenize by splitting on space, respecting quotes to prevent breaking json bodies
  const tokens: string[] = [];
  let currentToken = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;
  
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escapeNext) {
      currentToken += char;
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      currentToken += char;
      escapeNext = true;
      continue;
    }
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      currentToken += char;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      currentToken += char;
      continue;
    }
    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else {
      currentToken += char;
    }
  }
  if (currentToken) {
    tokens.push(currentToken);
  }

  const flags = [
    '-X', '--request',
    '-H', '--header',
    '-d', '--data', '--data-raw', '--data-binary',
    '-F', '--form',
    '-u', '--user',
    '--compressed',
    '--url'
  ];
  
  const lines: string[] = [];
  let currentLineTokens: string[] = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isNewRowFlag = flags.includes(token);
    
    if (isNewRowFlag && i > 0) {
      if (currentLineTokens.length > 0) {
        lines.push(currentLineTokens.join(' '));
      }
      currentLineTokens = [token];
    } else {
      currentLineTokens.push(token);
    }
  }
  if (currentLineTokens.length > 0) {
    lines.push(currentLineTokens.join(' '));
  }
  
  const formatted = lines.map((line, index) => {
    const isLast = index === lines.length - 1;
    const indent = index === 0 ? '' : '  ';
    const suffix = isLast ? '' : ' \\';
    return indent + line + suffix;
  });
  
  return formatted.join('\n');
};

export const formatCode = (rawCode: string, lang: string): string => {
  const trimmed = rawCode.trim();
  if (!trimmed) return '';

  if (lang === 'bash' || lang === 'shell' || trimmed.startsWith('curl')) {
    if (trimmed.startsWith('curl')) {
      try {
        return formatCurl(trimmed);
      } catch (e) {
        // Fallback to general formatting if parsing fails
      }
    } else {
      // General bash shell script formatting with keyword indent rules
      const lines = trimmed.split('\n');
      let indentLevel = 0;
      const formattedLines = lines.map((line) => {
        const currentLine = line.trim();
        if (!currentLine) return '';

        const startsWithFi = currentLine.startsWith('fi') || currentLine === 'fi';
        const startsWithDone = currentLine.startsWith('done') || currentLine === 'done';
        const startsWithEsac = currentLine.startsWith('esac') || currentLine === 'esac';
        const startsWithElseElif = currentLine.startsWith('else') || currentLine.startsWith('elif');

        if (startsWithFi || startsWithDone || startsWithEsac || startsWithElseElif) {
          indentLevel = Math.max(0, indentLevel - 1);
        }

        const spaces = '  '.repeat(indentLevel);
        const result = spaces + currentLine;

        const endsWithThen = currentLine.endsWith('; then') || currentLine.endsWith(' then') || currentLine === 'then';
        const endsWithDo = currentLine.endsWith('; do') || currentLine.endsWith(' do') || currentLine === 'do';
        const endsWithElse = currentLine === 'else';
        const startsWithIfForWhile = currentLine.startsWith('if ') || currentLine.startsWith('for ') || currentLine.startsWith('while ');

        if (endsWithThen || endsWithDo || endsWithElse || (startsWithIfForWhile && !currentLine.includes('; then') && !currentLine.includes('; do'))) {
          indentLevel++;
        }

        return result;
      });
      return formattedLines.join('\n');
    }
  }

  if (lang === 'json') {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch (e) {
      throw new Error('JSON 语法错误，无法格式化');
    }
  }

  if (lang === 'javascript' || lang === 'typescript') {
    try {
      return beautify.js(trimmed, {
        indent_size: 2,
        space_in_empty_paren: true,
        jslint_happy: true,
        end_with_newline: false,
      });
    } catch (e) {
      // Fallback to basic indent formatting below
    }
  }

  if (lang === 'html' || lang === 'xml' || lang === 'markdown') {
    try {
      return beautify.html(trimmed, {
        indent_size: 2,
        end_with_newline: false,
      });
    } catch (e) {
      // Fallback
    }
  }

  if (lang === 'css') {
    try {
      return beautify.css(trimmed, {
        indent_size: 2,
        end_with_newline: false,
      });
    } catch (e) {
      // Fallback
    }
  }

  // 通用的基于缩进的极简代码格式化逻辑，支持 JS/TS/CSS/Mermaid/HTML 等
  const lines = trimmed.split('\n');
  let indentLevel = 0;
  const formattedLines = lines.map((line) => {
    const currentLine = line.trim();
    if (!currentLine) return '';

    // 判断当前行是否以闭合括号开头，如果是，则该行缩进先回退一格
    const hasClose =
      currentLine.startsWith('}') || currentLine.startsWith(']') || currentLine.startsWith(')');
    if (hasClose) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    const spaces = '  '.repeat(indentLevel);
    const result = spaces + currentLine;

    // 判断当前行是否以开启括号/特殊 Mermaid 起始开头，如果是，则下一行缩进增加一格
    const hasOpen =
      currentLine.endsWith('{') ||
      currentLine.endsWith('[') ||
      currentLine.endsWith('(') ||
      currentLine.endsWith('->') ||
      currentLine.startsWith('graph') ||
      currentLine.startsWith('subgraph');

    if (hasOpen && !hasClose) {
      indentLevel++;
    }

    return result;
  });

  return formattedLines.join('\n');
};

// ==========================================
// 4. CustomCodeBlockView React 组件
// ==========================================
export function CustomCodeBlockView({ block, editor }: any) {
  const { language = 'mermaid', viewMode = 'split' } = block.props;
  const code = getBlockText(block); // 从 block.content 解析代码文本
  const [isEditing, setIsEditing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [formatError, setFormatError] = useState<string | null>(null);

  // 引入本地代码状态，避免每次按键调用 editor.updateBlock 导致整棵 ProseMirror 树重渲染/重挂载而失去焦点！
  const [localCode, setLocalCode] = useState(code);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 动态调整 textarea 高度自适应内容，完美解决高度变矮及与预览模式不一致的跳转问题
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [localCode, isEditing]);

  useEffect(() => {
    if (isEditing) {
      const timer = setTimeout(() => {
        adjustHeight();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  const handleFormat = () => {
    try {
      setFormatError(null);
      const formatted = formatCode(localCode, language);
      setLocalCode(formatted);
      saveChanges(formatted);
    } catch (err: any) {
      setFormatError(err.message || '格式化失败');
      setTimeout(() => {
        setFormatError(null);
      }, 3000);
    }
  };

  // 当外部 code 改变（例如 AI 更新了内容，或者初始化）时同步本地状态
  useEffect(() => {
    if (!isEditing) {
      setLocalCode(code);
    }
  }, [code, isEditing]);

  // 拦截 native DOM 事件，阻止其向上冒泡到 ProseMirror，从而彻底解决回车、删除、粘贴多行和选区干涉问题
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const eventsToStop = [
      'keydown',
      'keyup',
      'keypress',
      'copy',
      'paste',
      'cut',
      'mousedown',
      'mouseup',
      'mousemove',
    ];

    const handleStopEvent = (e: Event) => {
      e.stopPropagation();
    };

    eventsToStop.forEach((eventName) => {
      el.addEventListener(eventName, handleStopEvent);
    });

    return () => {
      eventsToStop.forEach((eventName) => {
        el.removeEventListener(eventName, handleStopEvent);
      });
    };
  }, [isEditing, language, viewMode]);

  // 当进入编辑状态时，强制 focus 并把光标定位到最后，带来最丝滑的体验
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // 保存数据回 ProseMirror 树
  const saveChanges = (value: string) => {
    if (value !== code) {
      editor.updateBlock(block.id, {
        content: [{ type: 'text', text: value }],
      });
    }
  };

  // 组件卸载时安全备份/保存修改，确保数据绝不丢失
  const latestLocalCodeRef = React.useRef(localCode);
  useEffect(() => {
    latestLocalCodeRef.current = localCode;
  }, [localCode]);

  useEffect(() => {
    return () => {
      saveChanges(latestLocalCodeRef.current);
    };
  }, []);

  const updateProps = (newProps: any) => {
    editor.updateBlock(block.id, {
      props: {
        ...block.props,
        ...newProps,
      },
    });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalCode(e.target.value);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLang = e.target.value;
    const nextMode = nextLang === 'mermaid' ? 'split' : 'edit';
    saveChanges(localCode);
    updateProps({ language: nextLang, viewMode: nextMode });
    if (nextLang !== 'mermaid') {
      setIsEditing(true); // 非 Mermaid 时默认打开编辑
    }
  };

  const handleViewModeChange = (mode: 'edit' | 'preview' | 'split') => {
    updateProps({ viewMode: mode });
  };

  const handleBlur = (e: React.FocusEvent) => {
    // 如果焦点依然在我们自定义块的容器内（例如用户点击了语言选择、预览切换或控制按钮），不触发退出编辑
    if (containerRef.current && containerRef.current.contains(e.relatedTarget as Node)) {
      return;
    }
    saveChanges(localCode);
    if (!isMermaid) {
      setIsEditing(false);
    }
  };

  const isMermaid = language === 'mermaid';

  return (
    <div
      ref={containerRef}
      contentEditable={false} // 绝对免疫 ProseMirror 的选区干涉，完美保持输入稳定性！
      style={{
        border: '1px solid var(--bn-colors-border, #e2e8f0)',
        borderRadius: 8,
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
        background: 'var(--bn-colors-editor-background, #ffffff)',
        // margin: '12px 0',
        color: 'var(--bn-colors-editor-text, #0f172a)',
        userSelect: 'text',
        width: '100%', // 宽度占满整行
        boxSizing: 'border-box',
      }}
    >
      {/* 强行覆盖 BlockNote 默认文本行宽限制，并清除内置 codeBlock 样式污染，让自定义代码块撑满 100% */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* 让外层 block 容器完全填满编辑器宽度并清除默认背景、边框 */
            .bn-block-outer[data-content-type="codeBlock"],
            .bn-block-outer[data-content-type="codeBlock"] > .bn-block-content {
              width: 100% !important;
              max-width: 100% !important;
              background: transparent !important;
              padding: 0 !important;
              // margin: 12px 0 !important;
              overflow: visible !important;
              border: none !important;
              border-radius: 0 !important;
            }
            /* 保证宿主 DOM 节点 and 渲染根节点拉满 100% 宽度 */
            .bn-custom-code-block,
            .bn-custom-code-block > div {
              width: 100% !important;
              box-sizing: border-box !important;
            }
            /* 纯本地化极简 Prism 语法高亮主题 —— 零外部网络请求依赖，优雅且独立 */
            .token.comment,
            .token.prolog,
            .token.doctype,
            .token.cdata {
              color: #94a3b8 !important;
              font-style: italic;
            }
            .token.punctuation {
              color: #64748b !important;
            }
            .token.property,
            .token.tag,
            .token.boolean,
            .token.number,
            .token.constant,
            .token.symbol,
            .token.deleted {
              color: #ea580c !important;
            }
            .token.selector,
            .token.attr-name,
            .token.string,
            .token.char,
            .token.builtin,
            .token.inserted {
              color: #16a34a !important;
            }
            .token.operator,
            .token.entity,
            .token.url,
            .language-css .token.string,
            .style .token.string {
              color: #0284c7 !important;
            }
            .token.atrule,
            .token.attr-value,
            .token.keyword {
              color: #2563eb !important;
              font-weight: 600;
            }
            .token.function,
            .token.class-name {
              color: #d97706 !important;
            }
            .token.regex,
            .token.important,
            .token.variable {
              color: #db2777 !important;
            }
            /* 让 textarea 中的占位符 (placeholder) 保持可见 */
            .bn-custom-code-block-textarea::placeholder {
              color: #94a3b8 !important;
              opacity: 1 !important;
            }
            /* 重置 CodeHighlighter 内部 pre/code 的浏览器默认样式，确保与 textarea 像素级完美对齐 */
            .ant-code-highlighter,
            .ant-code-highlighter pre,
            .ant-code-highlighter code {
              margin: 0 !important;
              padding: 0 !important;
              font-family: Consolas, Monaco, "Fira Code", Courier New, monospace !important;
              font-size: 13px !important;
              line-height: 1.6 !important;
              white-space: pre-wrap !important;
              word-break: break-all !important;
            }
          `,
        }}
      />
      {/* 极简融入的顶栏 */}
      <div
        style={{
          background: 'var(--bn-colors-side-menu-background, #f1f5f9)',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--bn-colors-border, #e2e8f0)',
        }}
      >
        {/* 左侧：选择语言 */}
        <select
          value={language}
          onChange={handleLanguageChange}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--bn-colors-editor-text, #475569)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {LANGUAGES.map((lang) => (
            <option
              key={lang.value}
              value={lang.value}
              style={{
                background: 'var(--bn-colors-editor-background, #ffffff)',
                color: 'var(--bn-colors-editor-text, #0f172a)',
              }}
            >
              {lang.label}
            </option>
          ))}
        </select>

        {/* 右侧：操作与视图切换区 */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 格式化按钮（仅在编辑状态下，或者非 Mermaid 语言下展示） */}
          {(isEditing || !isMermaid) && (
            <button
              onClick={handleFormat}
              style={{
                background: 'transparent',
                border: '1px solid var(--bn-colors-border, #cbd5e1)',
                borderRadius: 6,
                color: 'var(--bn-colors-editor-text, #475569)',
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--bn-colors-border, #f1f5f9)';
                e.currentTarget.style.color = 'var(--bn-colors-editor-text, #0f172a)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--bn-colors-editor-text, #475569)';
              }}
            >
              ✨ 格式化
            </button>
          )}

          {/* 视图切换按钮（仅在 Mermaid 语言下展示） */}
          {isMermaid && (
            <div
              style={{
                display: 'flex',
                background: 'var(--bn-colors-border, #e2e8f0)',
                borderRadius: 6,
                padding: 2,
              }}
            >
              {(['edit', 'preview', 'split'] as const).map((mode) => {
                const isActive = viewMode === mode;
                const modeLabels = {
                  edit: '编辑',
                  preview: '预览',
                  split: '双栏',
                };
                return (
                  <button
                    key={mode}
                    onClick={() => handleViewModeChange(mode)}
                    style={{
                      background: isActive
                        ? 'var(--bn-colors-editor-background, #ffffff)'
                        : 'transparent',
                      border: 'none',
                      borderRadius: 4,
                      color: isActive
                        ? 'var(--bn-colors-editor-text, #0f172a)'
                        : 'var(--bn-colors-editor-text, #64748b)',
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {modeLabels[mode]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 内容区域 —— 垂直上下分栏排版 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column', // 始终垂直上下排版
          background: 'var(--bn-colors-code-background, #f8fafc)',
          width: '100%',
        }}
      >
        {/* 编辑区/高亮代码区 */}
        {(viewMode === 'edit' || viewMode === 'split' || !isMermaid) && (
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              background: 'var(--bn-colors-code-background, #f8fafc)',
            }}
          >
            {formatError && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: 12,
                  padding: '5px 12px',
                  borderRadius: 6,
                  zIndex: 50,
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  pointerEvents: 'none',
                  fontWeight: 600,
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                ⚠️ {formatError}
              </div>
            )}
            {isEditing || (isMermaid && viewMode === 'split') ? (
              <textarea
                ref={textareaRef}
                value={localCode}
                onChange={handleTextChange}
                onBlur={handleBlur}
                className="ant-codeHighlighter css-dev-only-do-not-override-rl0yjc css-var-root"
                placeholder={
                  isMermaid ? 'graph TD\n  Start([Start]) --> End([End])' : '在此输入您的代码...'
                }
                spellCheck={false}
                style={{
                  width: '100%',
                  height: 'auto',
                  background: 'transparent',
                  fontFamily:
                    "'Fira Code', 'Fira Mono', 'Menlo', 'Consolas', 'DejaVu Sans Mono', 'monospace' ",
                  color: 'var(--bn-colors-editor-text, #0f172a)',
                  fontSize: 14,
                  lineHeight: 1.5,
                  padding: '1em',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  margin: 0,
                  display: 'block',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  border: '1px solid var(--bn-colors-border, #e2e8f0)',
                  borderTop: 'none',
                }}
              />
            ) : (
              <div onClick={() => setIsEditing(true)} style={{ cursor: 'text', width: '100%' }}>
                <CodeHighlighter
                  lang={language}
                  header={null} // 彻底关闭其内部自带的顶栏
                  style={{
                    background: 'transparent',
                    margin: 0,
                    border: 'none',
                    color: 'var(--bn-colors-editor-text, #0f172a)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {code || ' '}
                </CodeHighlighter>
              </div>
            )}
          </div>
        )}

        {/* 双栏模式下的横向分割线 */}
        {isMermaid && viewMode === 'split' && (
          <div
            style={{
              height: '1px',
              background: 'var(--bn-colors-border, #e2e8f0)',
              width: '100%',
            }}
          />
        )}

        {/* 预览区 */}
        {isMermaid && (viewMode === 'preview' || viewMode === 'split') && (
          <div
            style={{
              width: '100%',
              background: 'var(--bn-colors-editor-background, #ffffff)',
              padding: '20px',
              color: '#1e293b',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 220,
              boxSizing: 'border-box',
              position: 'relative',
            }}
          >
            {/* 浮动放大缩小控制栏 */}
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(4px)',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '2px 4px',
                zIndex: 10,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                userSelect: 'none',
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setZoom((prev) => Math.min(prev + 0.1, 2.5))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="放大 (Zoom In)"
              >
                ➕
              </button>
              <span
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  minWidth: 32,
                  textAlign: 'center',
                  fontWeight: 600,
                }}
              >
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((prev) => Math.max(prev - 0.1, 0.4))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="缩小 (Zoom Out)"
              >
                ➖
              </button>
              <button
                onClick={() => setZoom(1)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="还原 (Reset)"
              >
                🔄
              </button>
            </div>

            {/* 缩放渲染容器 */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                overflow: 'auto',
                flex: 1,
                paddingTop: '20px',
              }}
            >
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                  display: 'inline-block',
                }}
              >
                <Mermaid>{code}</Mermaid>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
