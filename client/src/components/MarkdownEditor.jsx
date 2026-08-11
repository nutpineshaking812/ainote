import React, { useCallback, useMemo, useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { Button, Space, Tooltip } from 'antd';

/**
 * MarkdownEditor
 * Props:
 *  value: string markdown content
 *  onChange: (val) => void
 *  height?: number
 *  fullscreen?: boolean
 *  onToggleFullscreen?: () => void
 *  previewMode?: 'edit' | 'preview' | 'live'
 *  onPreviewModeChange?: (mode) => void
 *  disabled?: boolean
 */
export default function MarkdownEditor({
  value,
  onChange,
  height = 420,
  fullscreen = false,
  onToggleFullscreen,
  previewMode = 'live',
  onPreviewModeChange,
  disabled = false,
}) {
  const containerStyle = useMemo(
    () => ({
      border: '1px solid #d9d9d9',
      borderRadius: 4,
      padding: 4,
      background: '#fff',
      position: 'relative',
    }),
    [],
  );

  const modes = ['edit', 'preview', 'live'];

  const cyclePreviewMode = useCallback(() => {
    const idx = modes.indexOf(previewMode);
    const next = modes[(idx + 1) % modes.length];
    onPreviewModeChange && onPreviewModeChange(next);
  }, [previewMode, onPreviewModeChange]);

  // Keyboard shortcut: Cmd/Ctrl + Shift + P to cycle preview
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        cyclePreviewMode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cyclePreviewMode]);

  return (
    <div
      data-color-mode="light"
      style={{ ...containerStyle, height: fullscreen ? '100%' : height }}
    >
      <Space size={4} style={{ marginBottom: 4 }}>
        <Tooltip title="切换分屏模式 (Cmd/Ctrl+Shift+P)">
          <Button size="small" onClick={cyclePreviewMode}>
            模式: {previewMode}
          </Button>
        </Tooltip>
        {onToggleFullscreen && (
          <Tooltip title={fullscreen ? '退出全屏' : '全屏编辑'}>
            <Button size="small" onClick={onToggleFullscreen}>
              {fullscreen ? '退出全屏' : '全屏'}
            </Button>
          </Tooltip>
        )}
      </Space>
      <MDEditor
        value={value}
        onChange={(val) => onChange && onChange(val || '')}
        height={fullscreen ? undefined : height}
        preview={previewMode}
        visibleDragbar={false}
        textareaProps={{ placeholder: '输入 Markdown 内容...' }}
        disableDraft={true}
        readOnly={disabled}
      />
    </div>
  );
}
