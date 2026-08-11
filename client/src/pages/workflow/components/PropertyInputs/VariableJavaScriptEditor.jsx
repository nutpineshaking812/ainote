import React, { useMemo, useState, useRef, useCallback } from 'react';
import { theme, Tooltip, Avatar, Button, Form } from 'antd';
import { RobotOutlined, ThunderboltOutlined, ExpandOutlined } from '@ant-design/icons';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, Decoration, MatchDecorator, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { useAICopilot, AICopilotModal } from './AICopilot';

const VariableJavaScriptEditor = ({ value = '', onChange, placeholder, style = {}, className, aiMeta, onAiMetaChange }) => {
  const { token } = theme.useToken();
  const form = Form.useFormInstance();

  // Controls whether the immersive Drawer IDE is visible
  const [modalOpen, setModalOpen] = useState(false);

  // Buffer ref to accumulate streaming code — avoids excessive re-renders via state
  const streamBufferRef = useRef('');

  // onChunk: called for every SSE delta — directly replaces editor value
  const handleChunk = useCallback((fullCodeSoFar) => {
    onChange?.(fullCodeSoFar);
  }, [onChange]);

  const handleDone = useCallback(() => {
    streamBufferRef.current = '';
  }, []);

  const copilot = useAICopilot({
    onChunk: handleChunk,
    onDone: handleDone,
  });

  // ── CodeMirror setup ────────────────────────────────────────────────────────

  const variableDecorator = useMemo(() => new MatchDecorator({
    regexp: /{{[^{}]+}}/g,
    decoration: Decoration.mark({
      attributes: {
        style: `
          background-color: ${token.colorPrimaryBg};
          color: ${token.colorPrimary};
          border: 1px solid ${token.colorPrimaryBorder};
          border-radius: 4px;
          padding: 0 2px;
          font-weight: bold;
        `
      }
    })
  }), [token]);

  const variablePlugin = useMemo(() => ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = variableDecorator.createDeco(view); }
    update(update) { this.decorations = variableDecorator.updateDeco(update, this.decorations); }
  }, { decorations: v => v.decorations }), [variableDecorator]);

  const atomicRangesPlugin = useMemo(() => ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = this.buildDecorations(view.state); }
    update(update) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.state);
      }
    }
    buildDecorations(state) {
      const rangeSet = new RangeSetBuilder();
      const text = state.doc.toString();
      const regex = /{{[^{}]+}}/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        rangeSet.add(match.index, match.index + match[0].length, Decoration.mark({ atomic: true }));
      }
      return rangeSet.finish();
    }
  }, { decorations: v => v.decorations }), []);

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
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-gutters': {
      backgroundColor: token.colorFillAlter,
      color: token.colorTextDescription,
      borderRight: `1px solid ${token.colorBorderSecondary}`,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    '.cm-activeLine':       { backgroundColor: 'transparent' },
  }), [token]);

  const extensions = useMemo(() => [
    javascript(),
    variablePlugin,
    atomicRangesPlugin,
    customTheme,
    EditorView.lineWrapping,
    ...(copilot.isGenerating ? [EditorView.editable.of(false)] : []),
  ], [variablePlugin, atomicRangesPlugin, customTheme, copilot.isGenerating]);

  // Handle updates to aiMeta object
  const patchAiMeta = useCallback((key, val) => {
    onAiMetaChange?.({ ...aiMeta, [key]: val });
  }, [aiMeta, onAiMetaChange]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorder}`,
        overflow: 'hidden',
        ...style,
      }}
      className={className}
    >
      {/* ── Top toolbar ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillAlter,
          minHeight: 36,
        }}
      >
        {/* Left: label or generating status */}
        <span style={{ fontSize: 11, color: token.colorTextDescription, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ThunderboltOutlined style={{ fontSize: 12, color: token.colorPrimary }} />
          <span style={{ fontWeight: 600 }}>AI 协同脚本组件</span>
        </span>

        {/* Right: employee avatars & 沉浸式编辑 button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {copilot.employees.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {copilot.employees.map((emp) => {
                const empId = emp._id || emp.id;
                return (
                  <Tooltip
                    key={empId}
                    title={
                      <div style={{ fontSize: 11, padding: '2px 4px' }}>
                        <strong style={{ display: 'block' }}>{emp.name}</strong>
                        <span style={{ color: 'rgba(255,255,255,0.75)' }}>{emp.roleTitle || 'AI 助理'}</span>
                        <div style={{ color: token.colorPrimaryLight, marginTop: 2, fontWeight: 'bold' }}>
                          点击唤醒专业 AI 沙箱
                        </div>
                      </div>
                    }
                    placement="bottom"
                    mouseEnterDelay={0.2}
                  >
                    <div
                      onClick={() => {
                        copilot.setSelectedEmployeeId(empId);
                        setModalOpen(true);
                      }}
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        padding: '1px',
                        background: token.colorBorderSecondary,
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      <Avatar
                        src={emp.avatar}
                        size={20}
                        style={{
                          backgroundColor: !emp.avatar ? token.colorPrimary : 'transparent',
                          color: '#fff',
                          fontSize: 9,
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {emp.avatar ? null : (emp.name?.[0] || <RobotOutlined style={{ fontSize: 9, color: '#fff' }} />)}
                      </Avatar>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          )}

          {/* Immersive editor button */}
          <Button
            type="primary"
            size="small"
            ghost
            icon={<ExpandOutlined />}
            onClick={() => setModalOpen(true)}
            style={{ fontSize: 11, height: 22, display: 'flex', alignItems: 'center', gap: 3 }}
          >
            沉浸式编辑
          </Button>
        </div>
      </div>

      {/* CodeMirror editor - fixed height for property panel */}
      <div style={{ flex: 1, height: '160px', position: 'relative' }}>
        <CodeMirror
          value={value}
          height="100%"
          width="100%"
          theme="light"
          placeholder={placeholder}
          extensions={extensions}
          onChange={(val) => !copilot.isGenerating && onChange?.(val)}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            foldGutter: true,
            allowMultipleSelections: false,
          }}
        />
      </div>

      {/* Mount upgraded Drawer Code Sandbox Modal */}
      <AICopilotModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        isGenerating={copilot.isGenerating}
        generatedCode={value}
        aiMeta={aiMeta}
        onAiMetaChange={(meta) => {
          onAiMetaChange?.(meta);
          if (form) {
            const currentParams = form.getFieldValue('pluginParams') || {};
            form.setFieldsValue({
              pluginParams: {
                ...currentParams,
                aiMeta: meta,
              }
            });
          }
        }}
        onGenerate={copilot.generate}
        onAbort={copilot.abort}
        handleApply={(finalCode) => {
          onChange?.(finalCode);
          setModalOpen(false);
        }}
        handleSave={(finalCode) => {
          onChange?.(finalCode);
        }}
        employees={copilot.employees}
        selectedEmployeeId={copilot.selectedEmployeeId}
        setSelectedEmployeeId={copilot.setSelectedEmployeeId}
      />

    </div>
  );
};

export default VariableJavaScriptEditor;
