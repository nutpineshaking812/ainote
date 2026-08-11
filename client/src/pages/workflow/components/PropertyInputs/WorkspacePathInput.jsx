import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import VariableInput from './VariableInput';
import { isTauri } from '../../../../utils/platform';

const WorkspacePathInput = ({ value, onChange, placeholder, ...rest }) => {
  const [loading, setLoading] = useState(false);
  const [defaultOSPath, setDefaultOSPath] = useState('');
  const containerRef = useRef(null);

  // 仅在 Tauri 下获取当前操作系统的默认路径以做 placeholder 友好提示
  useEffect(() => {
    if (isTauri) {
      (async () => {
        try {
          const { documentDir, join } = await import('@tauri-apps/api/path');
          const docDir = await documentDir();
          const defaultPath = await join(docDir, 'ainote_workspace');
          setDefaultOSPath(defaultPath);
        } catch (e) {
          console.error(e);
        }
      })();
    }
  }, [isTauri]);

  // 当路径值改变或初次渲染时，自动向右滚动 input 显示文件夹路径末尾部分
  useEffect(() => {
    if (value && containerRef.current) {
      const inputEl = containerRef.current.querySelector('input');
      if (inputEl) {
        requestAnimationFrame(() => {
          inputEl.scrollLeft = inputEl.scrollWidth;
        });
      }
    }
  }, [value]);

  if (!isTauri) {
    return null;
  }

  const handleBrowse = async () => {
    if (!isTauri) return;
    setLoading(true);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: value || defaultOSPath,
      });

      if (selected) {
        onChange?.(selected);
      }
    } catch (err) {
      console.error('Failed to open directory dialog:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', gap: '8px', width: '100%' }}>
      <div style={{ flex: 1 }}>
        <VariableInput
          value={value}
          onChange={onChange}
          placeholder={placeholder || (defaultOSPath ? `默认: ${defaultOSPath}` : "例如: /Users/username/Documents/ainote")}
          allowClear={true}
          {...rest}
        />
      </div>
      {isTauri && (
        <Button
          icon={<FolderOpenOutlined />}
          loading={loading}
          onClick={handleBrowse}
        >
          浏览
        </Button>
      )}
    </div>
  );
};

export default WorkspacePathInput;
