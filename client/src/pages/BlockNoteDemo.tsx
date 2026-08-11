import React, { useEffect, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { customSchema } from '../components/blocknote/blocks';

export default function BlockNoteDemoPage() {
  const editor = useCreateBlockNote({
    schema: customSchema,
    initialContent: [
      {
        type: 'paragraph',
        content: '下面是一个自定义 IDE 风格的代码块组件，支持实时编译并渲染 Mermaid 图表：',
      },
      {
        type: 'codeBlock',
        props: {
          language: 'mermaid',
          code: 'graph TD\n  Start([🚀 开启体验]) --> Edit[✍️ 编辑代码]\n  Edit --> Preview[📊 双栏实时预览]\n  Preview --> Success([🎉 完美交付])',
          viewMode: 'split',
        },
      },
      {
        type: 'paragraph',
      },
    ],
  });

  const [docJson, setDocJson] = useState('');
  const [docMarkdown, setDocMarkdown] = useState('');
  const [activeTab, setActiveTab] = useState<'json' | 'markdown'>('json');

  // 监听编辑器文档变动，实时提取 JSON 数据与 Markdown 导出数据
  useEffect(() => {
    if (!editor) return;

    const updateInspector = async () => {
      const doc = editor.document;
      setDocJson(JSON.stringify(doc, null, 2));
      try {
        const md = await editor.blocksToMarkdownLossy(doc);
        setDocMarkdown(md);
      } catch (err) {
        console.error('Failed to export markdown:', err);
      }
    };

    updateInspector(); // 初始加载
    const unsubscribe = editor.onChange(updateInspector);
    return () => {
      unsubscribe?.();
    };
  }, [editor]);

  return (
    <div
      style={{
        maxWidth: 1000,
        margin: '0 auto',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* 顶部指引 */}
      <div
        style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          fontSize: 13,
          color: '#475569',
        }}
      >
        💡 <b>自定义 IDE 风格代码块</b>：输入{' '}
        <code
          style={{
            background: '#f1f5f9',
            padding: '2px 6px',
            borderRadius: 4,
            fontFamily: 'monospace',
          }}
        >
          /code
        </code>{' '}
        插入新代码块。 可在代码块顶栏切换不同的编程语言。当切换为 <b>Mermaid</b>{' '}
        时，即可在编辑区内无缝体验<b>「上下实时预览」</b>、<b>「编辑」</b>与<b>「预览」</b>
        多模式的快速切换！
      </div>

      {/* 编辑器容器 */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        }}
      >
        <BlockNoteView editor={editor} theme="light" />
      </div>

      {/* 底部数据分析与导出器 */}
      <div
        style={{
          marginTop: 24,
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* 控制顶栏 */}
        <div
          style={{
            background: '#f8fafc',
            padding: '10px 16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            🔍 数据与导出实时 analysis 器 (Inspector)
          </span>
          <div
            style={{ display: 'flex', gap: 8, background: '#f1f5f9', padding: 2, borderRadius: 6 }}
          >
            <button
              onClick={() => setActiveTab('json')}
              style={{
                padding: '4px 12px',
                borderRadius: 4,
                border: 'none',
                background: activeTab === 'json' ? '#ffffff' : 'transparent',
                color: activeTab === 'json' ? '#0f172a' : '#64748b',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'json' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              📦 BlockNote JSON 结构
            </button>
            <button
              onClick={() => setActiveTab('markdown')}
              style={{
                padding: '4px 12px',
                borderRadius: 4,
                border: 'none',
                background: activeTab === 'markdown' ? '#ffffff' : 'transparent',
                color: activeTab === 'markdown' ? '#0f172a' : '#64748b',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'markdown' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              📝 导出的 Markdown
            </button>
          </div>
        </div>

        {/* 动态内容展示区 */}
        <div style={{ padding: '16px', background: '#f8fafc', maxHeight: 380, overflowY: 'auto' }}>
          {activeTab === 'json' ? (
            <pre
              style={{
                margin: 0,
                padding: '12px',
                background: '#f1f5f9',
                borderRadius: '6px',
                fontSize: '12px',
                overflowX: 'auto',
              }}
            >
              {docJson}
            </pre>
          ) : (
            <pre
              style={{
                margin: 0,
                padding: '12px',
                background: '#f1f5f9',
                borderRadius: '6px',
                fontSize: '12px',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {docMarkdown}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
