import React, { useCallback, useEffect, useState } from 'react';
import { Upload, Button, message } from 'antd';
import { UploadOutlined, PaperClipOutlined } from '@ant-design/icons';
import { uploadAttachment } from '../../../../api/upload';
import styles from './Renderer.module.css';

// Normalize value (array of {uid,name,url})
const normalizeValueToFileList = (raw) => {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((item, i) => {
      if (typeof item === 'string') {
        return {
          uid: `att-${i}`,
          name: item.split('/').pop() || `附件-${i + 1}`,
          url: item,
          status: 'done',
        };
      }
      const { uid = `att-${i}`, name = item.name || `附件-${i + 1}`, url } = item;
      return { uid, name, url, status: item.status || 'done' };
    })
    .filter((f) => f.url);
};

const toOutputValue = (fl) =>
  fl.map(({ uid, name, url, size, mime }) => ({ uid, name, url, size, mime }));

const Renderer = ({ field, value, onChange, disabled }) => {
  const props = field.properties || {};
  const maxCount = Number(props.maxCount) || 1;
  const maxFileSizeEnabled = props.maxFileSizeEnabled === true;
  const maxFileSizeMB = Number(props.maxFileSizeMB) || 5;
  const allowedTypes = Array.isArray(props.allowedTypes) ? props.allowedTypes.filter(Boolean) : [];
  const maxFileSizeBytes = maxFileSizeMB ? maxFileSizeMB * 1024 * 1024 : null;

  const [fileList, setFileList] = useState(() => normalizeValueToFileList(value));
  useEffect(() => {
    setFileList(normalizeValueToFileList(value));
  }, [value]);

  const emitChange = useCallback(
    (next) => {
      onChange(toOutputValue(next));
    },
    [onChange],
  );

  const validateFile = useCallback(
    (file) => {
      if (maxCount && fileList.length >= maxCount) {
        message.warning(`最多上传 ${maxCount} 个附件`);
        return false;
      }
      if (maxFileSizeBytes && file.size > maxFileSizeBytes) {
        message.error(`单个文件大小不能超过 ${maxFileSizeMB} MB`);
        return false;
      }
      if (allowedTypes.length) {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (!allowedTypes.map((t) => t.toLowerCase()).includes(ext)) {
          message.error(`文件类型不允许: .${ext}`);
          return false;
        }
      }
      return true;
    },
    [fileList.length, maxCount, maxFileSizeBytes, maxFileSizeMB, allowedTypes],
  );

  const handleRemove = useCallback(
    (file) => {
      if (disabled) return;
      const next = fileList.filter((f) => f.uid !== file.uid);
      setFileList(next);
      emitChange(next);
    },
    [fileList, emitChange, disabled],
  );

  const customRequest = useCallback(
    async (options) => {
      if (disabled) return;
      const { file, onSuccess, onError, onProgress } = options;
      try {
        if (!validateFile(file)) return onError?.(new Error('验证失败'));
        const info = await uploadAttachment(file, {
          onProgress: (p) => onProgress && onProgress({ percent: p }),
          usageType: 'form_field',
          usageId: field.id || field.key,
        });
        const nextItem = {
          uid: file.uid,
          name: info.originalName || file.name,
          url: info.url,
          size: info.size,
          mime: info.mime,
          status: 'done',
          icon: <PaperClipOutlined />,
        };
        const updated = [...fileList, nextItem];
        setFileList(updated);
        emitChange(updated);
        onSuccess(info, file);
      } catch (e) {
        message.error(e.message || '上传失败');
        onError(e);
      }
    },
    [emitChange, fileList, validateFile, disabled],
  );

  // Unified processing for external files (drag/paste)
  const processIncomingFiles = useCallback(
    async (files) => {
      if (!files || !files.length || disabled) return;
      const list = Array.from(files);
      const accepted = [];
      for (const f of list) {
        if (!validateFile(f)) continue; // validateFile already shows messages
        accepted.push(f);
        if (maxCount && fileList.length + accepted.length >= maxCount) break;
      }
      if (!accepted.length) return;
      for (const f of accepted) {
        await customRequest({ file: f, onSuccess: () => {}, onError: () => {} });
      }
    },
    [customRequest, fileList.length, maxCount, validateFile, disabled],
  );

  const [dragOver, setDragOver] = useState(false);
  const handleDragOver = useCallback(
    (e) => {
      if (disabled) return;
      e.preventDefault();
      if (!dragOver) setDragOver(true);
    },
    [dragOver, disabled],
  );
  const handleDragLeave = useCallback(() => {
    if (dragOver) setDragOver(false);
  }, [dragOver]);
  const handleDrop = useCallback(
    async (e) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      await processIncomingFiles(e.dataTransfer?.files);
      setDragOver(false);
    },
    [processIncomingFiles, disabled],
  );

  const [focused, setFocused] = useState(false);
  const handlePaste = useCallback(
    async (e) => {
      if (!focused || disabled) return;
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      if (!items) return;
      const files = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        await processIncomingFiles(files);
      }
    },
    [focused, processIncomingFiles, disabled],
  );

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <div
      className={dragOver ? `${styles.dropzone} ${styles.dragOver}` : styles.dropzone}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      tabIndex={0}
      onFocus={() => !disabled && setFocused(true)}
      onBlur={() => setFocused(false)}
      style={disabled ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
    >
      <Upload
        listType="text"
        multiple={!!(maxCount === null || maxCount > 1)}
        maxCount={maxCount || undefined}
        fileList={fileList}
        customRequest={customRequest}
        onRemove={handleRemove}
        beforeUpload={(file) => (validateFile(file) && !disabled ? true : Upload.LIST_IGNORE)}
        accept={allowedTypes.length ? allowedTypes.map((ext) => '.' + ext).join(',') : undefined}
        disabled={disabled}
      >
        <div className={styles.uploadButtonWrapper}>
          <Button icon={<UploadOutlined />} disabled={disabled || (maxCount && fileList.length >= maxCount)}>
            上传 / 拖拽 / 粘贴附件
          </Button>
        </div>
      </Upload>
      <div className={styles.hint}>
        <span>
          支持 <strong>点击</strong>、<strong>拖拽</strong> 或 <strong>粘贴</strong> 上传
        </span>
        {maxCount && <span>最多 {maxCount} 个</span>}
        {<span>单文件 ≤ {maxFileSizeMB}MB</span>}
        {allowedTypes.length > 0 && (
          <span>
            类型: {allowedTypes.slice(0, 5).join(',')}
            {allowedTypes.length > 5 ? '...' : ''}
          </span>
        )}
      </div>
    </div>
  );
};

export default Renderer;
