import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Upload, Button, message } from 'antd';
import styles from './Renderer.module.css';
import { UploadOutlined } from '@ant-design/icons';
import { fileToDataUrl, compressImageToFile } from '../../../../utils/imageUtils';
import { uploadImage } from '../../../../api/upload';

const QUALITY = 0.7; // default compression quality

const normalizeValueToFileList = (rawValue) => {
  if (!rawValue) {
    return [];
  }

  const list = Array.isArray(rawValue) ? rawValue : [rawValue];

  return list
    .map((item, index) => {
      if (!item) {
        return null;
      }
      if (typeof item === 'string') {
        return {
          uid: `image-${index}`,
          name: `image-${index + 1}`,
          url: item,
          status: 'done',
        };
      }
      const uid = item.uid || `image-${index}`;
      const name = item.name || `image-${index + 1}`;
      const url = item.url || item.thumbUrl;
      if (!url) {
        return null;
      }
      return {
        uid,
        name,
        url,
        status: item.status || 'done',
      };
    })
    .filter(Boolean);
};

const toOutputValue = (fileList) => fileList.map(({ uid, name, url }) => ({ uid, name, url }));

// NOTE: compression now provided by imageUtils (compressImageToFile)

const Renderer = ({ field, value, onChange }) => {
  const properties = field.properties || {};
  const resolvedMaxCount = useMemo(() => {
    const parsed = Number(properties.maxCount);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }, [properties.maxCount]);

  const listType = properties.displayMode === 'list' ? 'picture' : 'picture-card';
  const autoCompress = properties.autoCompressEnabled === true;
  const maxFileSizeEnabled = properties.maxFileSizeEnabled === true;
  const maxFileSizeMB = Number(properties.maxFileSizeMB) || 5;
  const maxFileSizeBytes =
    maxFileSizeEnabled && maxFileSizeMB && maxFileSizeMB > 0 ? maxFileSizeMB * 1024 * 1024 : null;

  const [fileList, setFileList] = useState(() => normalizeValueToFileList(value));

  useEffect(() => {
    setFileList(normalizeValueToFileList(value));
  }, [value]);

  const emitChange = useCallback(
    (nextList) => {
      onChange(toOutputValue(nextList));
    },
    [onChange],
  );

  useEffect(() => {
    if (resolvedMaxCount && fileList.length > resolvedMaxCount) {
      const trimmed = fileList.slice(0, resolvedMaxCount);
      setFileList(trimmed);
      emitChange(trimmed);
    }
  }, [resolvedMaxCount, fileList, emitChange]);

  const validateFile = useCallback(
    (file, silent = false) => {
      if (!file) return { ok: false };
      if (file.type && !file.type.startsWith('image/')) {
        if (!silent) message.error('仅支持上传图片文件');
        return { ok: false };
      }
      if (resolvedMaxCount && fileList.length >= resolvedMaxCount) {
        if (!silent) message.warning(`最多上传 ${resolvedMaxCount} 张图片`);
        return { ok: false };
      }
      if (maxFileSizeBytes && file.size > maxFileSizeBytes) {
        if (!silent) message.error(`单个文件大小不能超过 ${maxFileSizeMB} MB`);
        return { ok: false };
      }
      return { ok: true };
    },
    [fileList.length, maxFileSizeBytes, maxFileSizeMB, resolvedMaxCount],
  );

  const handleBeforeUpload = useCallback(
    async (file) => {
      const { ok } = validateFile(file);
      return ok ? true : Upload.LIST_IGNORE;
    },
    [validateFile],
  );

  const handleRemove = useCallback(
    (file) => {
      const filtered = fileList.filter((item) => item.uid !== file.uid);
      setFileList(filtered);
      emitChange(filtered);
    },
    [emitChange, fileList],
  );

  const handlePreview = useCallback(async (file) => {
    const src = file.url || (file.originFileObj ? await fileToDataUrl(file.originFileObj) : '');
    if (!src) {
      return;
    }
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(`<img src="${src}" style="max-width: 100%; height: auto;" />`);
    }
  }, []);

  const customRequest = useCallback(
    async (options) => {
      const { file, onSuccess, onError, onProgress } = options;
      try {
        let processedFile = file;
        if (autoCompress) {
          try {
            processedFile = await compressImageToFile(file, QUALITY);
          } catch (e) {
            // Silent fallback to original file
          }
        }

        const fileInfo = await uploadImage(processedFile, {
          onProgress: (percent) => {
            if (onProgress) {
              onProgress({ percent });
            }
          },
          usageType: 'form_field',
          usageId: field.id || field.key,
        });

        const nextItem = {
          uid: file.uid,
          name: fileInfo.originalName || file.name,
          url: fileInfo.url,
          status: 'done',
        };
        const updated = [...fileList, nextItem];
        setFileList(updated);
        emitChange(updated);
        onSuccess(fileInfo, file);
      } catch (err) {
        message.error(err.message || '上传失败');
        onError(err);
      }
    },
    [autoCompress, emitChange, fileList],
  );

  // Drag & Drop support (basic). We'll treat dropped files same as selected ones.
  // Unified processing for incoming files (drag & paste)
  const processIncomingFiles = useCallback(
    async (files) => {
      if (!files || !files.length) return;
      const list = Array.from(files);
      const accepted = [];
      for (const f of list) {
        if (!validateFile(f, true).ok) continue;
        accepted.push(f);
        if (resolvedMaxCount && fileList.length + accepted.length >= resolvedMaxCount) break;
      }
      if (!accepted.length) {
        message.warning('没有可添加的图片或已达到数量上限');
        return;
      }
      for (const f of accepted) {
        await customRequest({ file: f, onSuccess: () => {}, onError: () => {} });
      }
    },
    [customRequest, fileList.length, resolvedMaxCount, validateFile],
  );

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await processIncomingFiles(e.dataTransfer?.files);
    },
    [processIncomingFiles],
  );
  // Focus-controlled paste: only when wrapper focused
  const [focused, setFocused] = useState(false);
  const handlePaste = useCallback(
    async (e) => {
      if (!focused) return;
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      if (!items) return;
      const files = [];
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        await processIncomingFiles(files);
      }
    },
    [focused, processIncomingFiles],
  );

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const [dragOver, setDragOver] = useState(false);
  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      if (!dragOver) setDragOver(true);
    },
    [dragOver],
  );
  const handleDragLeave = useCallback(
    (e) => {
      if (dragOver) setDragOver(false);
    },
    [dragOver],
  );

  return (
    <div
      onDrop={(e) => {
        handleDrop(e);
        setDragOver(false);
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      tabIndex={0}
      className={dragOver ? `${styles.dropzone} ${styles.dragOver}` : styles.dropzone}
    >
      <Upload
        listType={listType}
        multiple={resolvedMaxCount > 1}
        maxCount={resolvedMaxCount}
        fileList={fileList}
        accept="image/*"
        beforeUpload={handleBeforeUpload}
        customRequest={customRequest}
        onRemove={handleRemove}
        onPreview={handlePreview}
      >
        <div className={styles.uploadButtonWrapper}>
          <Button
            icon={<UploadOutlined />}
            disabled={resolvedMaxCount && fileList.length >= resolvedMaxCount}
          >
            上传
          </Button>
        </div>
      </Upload>
      <div className={styles.hint}>
        <span>
          支持 <strong>点击</strong>、<strong>拖拽</strong> 或 <strong>粘贴</strong> 图片
        </span>
        <span>
          <code>Ctrl/Cmd + V</code> 粘贴截图
        </span>
        {resolvedMaxCount && <span>最多 {resolvedMaxCount} 张</span>}
        {maxFileSizeEnabled && <span>单文件 ≤ {properties.maxFileSizeMB}MB</span>}
        {autoCompress && <span>已启用自动压缩</span>}
      </div>
    </div>
  );
};

export default Renderer;
