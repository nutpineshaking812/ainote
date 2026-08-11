import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import ReactQuill from 'react-quill';
import TurndownService from 'turndown';
import { marked } from 'marked';
import 'react-quill/dist/quill.snow.css';

// Configure marked (lightweight sanitization or customization could be added here)
marked.setOptions({
  breaks: true,
  gfm: true,
});

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Task list rule
turndown.addRule('taskList', {
  filter: (node) => node.tagName === 'LI' && node.querySelector('input[type=checkbox]'),
  replacement: (content, node) => {
    const checked = node.querySelector('input')?.checked;
    return `- [${checked ? 'x' : ' '}] ${content.trim()}\n`;
  },
});

// Toolbar config
const toolbar = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'code-block'],
  ['link', 'image'],
  [{ align: [] }],
  ['clean'],
];

const RichMarkdownEditor = forwardRef(function RichMarkdownEditor(
  { markdown, onMarkdownChange, height = 480, readOnly = false, autoFocus = true },
  ref,
) {
  const quillRef = useRef(null);
  const [html, setHtml] = useState('');
  const lastSyncedMdRef = useRef('');

  // Sync markdown -> html
  useEffect(() => {
    if (markdown == null) {
      setHtml('');
      lastSyncedMdRef.current = '';
      return;
    }
    if (markdown === lastSyncedMdRef.current) return; // no change
    const rendered = marked.parse(markdown || '');
    setHtml(rendered);
    lastSyncedMdRef.current = markdown;
  }, [markdown]);

  const emitMarkdown = (htmlContent, source) => {
    const md = turndown.turndown(htmlContent || '');
    lastSyncedMdRef.current = md;
    if (onMarkdownChange) onMarkdownChange(md, source);
  };

  const handleChange = (content, _delta, source) => {
    setHtml(content);
    if (source === 'user') emitMarkdown(content, source);
  };

  useImperativeHandle(
    ref,
    () => ({
      focus: () => quillRef.current?.getEditor().focus(),
      getMarkdown: () => turndown.turndown(quillRef.current?.getEditor().root.innerHTML || ''),
      setMarkdown: (md) => {
        const rendered = marked.parse(md || '');
        setHtml(rendered);
        lastSyncedMdRef.current = md || '';
        if (onMarkdownChange) onMarkdownChange(md || '', 'program');
      },
    }),
    [onMarkdownChange],
  );

  return (
    <div style={{ height }}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={html}
        readOnly={readOnly}
        onChange={handleChange}
        modules={{ toolbar }}
        style={{ height: height - 42 }}
      />
    </div>
  );
});

export default RichMarkdownEditor;
