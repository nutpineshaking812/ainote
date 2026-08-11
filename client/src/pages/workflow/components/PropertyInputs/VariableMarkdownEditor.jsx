import React, { useMemo } from 'react';
import { theme } from 'antd';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, Decoration, MatchDecorator, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

const VariableMarkdownEditor = ({ value = '', onChange, placeholder, style = {}, className }) => {
  const { token } = theme.useToken();

  // 1. 定义变量的高亮装饰器
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
    constructor(view) {
      this.decorations = variableDecorator.createDeco(view);
    }
    update(update) {
      this.decorations = variableDecorator.updateDeco(update, this.decorations);
    }
  }, {
    decorations: v => v.decorations
  }), [variableDecorator]);

  // 2. 定义原子范围 (光标跳过变量块，且支持原子删除)
  const atomicRangesPlugin = useMemo(() => ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = this.buildDecorations(view.state);
    }
    update(update) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.state);
      }
    }
    buildDecorations(state) {
      const builder = new RangeSetBuilder();
      const text = state.doc.toString();
      const regex = /{{[^{}]+}}/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        builder.add(match.index, match.index + match[0].length, Decoration.mark({ atomic: true }));
      }
      return builder.finish();
    }
  }, {
    decorations: v => v.decorations
  }), []);

  // 3. 自定义主题 (适配 Ant Design)
  const customTheme = useMemo(() => EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '14px',
      backgroundColor: token.colorBgContainer,
    },
    '.cm-content': {
      fontFamily: 'monospace',
      padding: '16px 0',
    },
    '.cm-line': {
      padding: '0 16px',
      lineHeight: '1.6',
    },
    '&.cm-focused': {
        outline: 'none',
    },
    '.cm-gutters': {
      backgroundColor: token.colorFillAlter,
      color: token.colorTextDescription,
      borderRight: `1px solid ${token.colorBorderSecondary}`,
      fontFamily: 'monospace',
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
    },
    '.cm-activeLine': {
        backgroundColor: 'transparent',
    }
  }), [token]);

  // 4. 组合扩展
  const extensions = useMemo(() => [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    variablePlugin,
    atomicRangesPlugin,
    customTheme,
    EditorView.lineWrapping,
    // 如果需要占位符，CodeMirror 有专门的 placeholder 扩展，但 @uiw/react-codemirror 已经封装了属性
  ], [variablePlugin, atomicRangesPlugin, customTheme]);

  return (
    <div 
      className={`variable-markdown-editor ${className || ''}`}
      style={{ 
        display: 'flex',
        flex: 1, 
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorder}`,
        overflow: 'hidden',
        height: '300px', // 默认高度，可以根据外部 style 覆盖
        ...style 
      }}
    >
      <CodeMirror
        value={value}
        height="100%"
        width="100%"
        theme="light" // 我们已经用 customTheme 覆盖了，这里传 light 作为基色
        placeholder={placeholder}
        extensions={extensions}
        onChange={(val) => onChange && onChange(val)}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: false,
          highlightActiveLine: false,
          foldGutter: false,
          allowMultipleSelections: false,
        }}
      />
    </div>
  );
};

export default VariableMarkdownEditor;
