import React, { useRef, useEffect, useCallback } from 'react';
import { Input } from 'antd';

/**
 * EditorTitle - 独立的笔记标题组件，不依赖 BlockNote
 *
 * Props:
 *   value        {string}   - 当前标题文本
 *   onChange     {fn(value) => void}  - 标题变化回调
 *   onEnter      {fn() => void}       - 按下回车时跳转到编辑器
 *   placeholder  {string}   - 占位符
 *   readOnly     {boolean}  - 只读模式
 *   autoFocus    {boolean}  - 是否自动聚焦
 *   originalFileInfo {object} - { id, name } - 原始文件下载信息
 *   onDownload   {fn() => void} - 下载原始文件回调
 */
const EditorTitle = ({
  value = '',
  onChange,
  onEnter,
  placeholder = '无标题',
  readOnly = false,
  autoFocus = false,
}) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current && !readOnly) {
      const el = inputRef.current.input || inputRef.current;
      el?.focus?.();
    }
  }, [autoFocus, readOnly]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onEnter?.();
      }
    },
    [onEnter],
  );

  const handleChange = useCallback(
    (e) => {
      onChange?.(e.target.value);
    },
    [onChange],
  );

  return (
    <div className="editor-title-wrapper">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        readOnly={readOnly}
        variant="borderless"
        className="editor-title-input"
      />
    </div>
  );
};

export default EditorTitle;
