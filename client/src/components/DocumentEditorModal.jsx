import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Space, Typography, Tooltip, Button } from 'antd';
import { FullscreenOutlined, FullscreenExitOutlined, CloseOutlined } from '@ant-design/icons';
import NoteEditor from './blocknote/NoteEditor';

const { Text } = Typography;

const DocumentEditorModal = ({
  open,
  title,
  onClose,
  children,
  footer,
  headerExtra,
  allowFullScreen = true,
  width = 900,
  destroyOnClose = false,
  bodyStyle,
  style,
  editorProps,
  editorKey,
  ...restModalProps
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsFullScreen(false);
    }
  }, [open]);

  const computedWidth = allowFullScreen && isFullScreen ? '100vw' : width;
  const mergedStyle =
    allowFullScreen && isFullScreen
      ? { top: 0, paddingBottom: 0, margin: 0, maxWidth: '100vw', ...style }
      : style;

  const mergedBodyStyle = {
    paddingTop: 0,
    overflowY: 'auto',
    ...(allowFullScreen && isFullScreen ? { maxHeight: 'none', height: 'calc(100vh - 40px)' } : {}),
    ...bodyStyle,
  };

  const handleClose = () => {
    setIsFullScreen(false);
    onClose?.();
  };

  const resolvedEditorProps = useMemo(() => {
    if (!editorProps) return null;
    const baseHeight = editorProps.height ?? 420;
    const fullHeight = (() => {
      if (!allowFullScreen || !isFullScreen) return baseHeight;
      if (typeof window === 'undefined') return baseHeight;
      return Math.max(window.innerHeight - 180, 320);
    })();
    return { ...editorProps, height: fullHeight };
  }, [editorProps, allowFullScreen, isFullScreen]);

  return (
    <Modal
      open={open}
      footer={null}
      closable={false}
      destroyOnHidden={destroyOnClose}
      width={computedWidth}
      style={mergedStyle}
      styles={{ body: mergedBodyStyle }}
      onCancel={handleClose}
      zIndex={1200}
      {...restModalProps}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 0 8px 0',
        }}
      >
        <Text strong style={{ fontSize: 18 }}>
          {title}
        </Text>
        <Space size={8}>
          {headerExtra}
          {allowFullScreen && (
            <Tooltip title={isFullScreen ? '退出全屏' : '全屏编辑'}>
              <Button
                type="text"
                icon={isFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={() => setIsFullScreen((prev) => !prev)}
              />
            </Tooltip>
          )}
          <button
            type="button"
            className="ant-modal-close"
            style={{ position: 'static', width: 40, height: 40, padding: 0, lineHeight: 1 }}
            onClick={handleClose}
            aria-label="关闭"
          >
            <span className="ant-modal-close-x">
              <CloseOutlined />
            </span>
          </button>
        </Space>
      </div>
      <div style={{ width: '100%', display: 'flex', overflow: 'auto' }}>
        {resolvedEditorProps && (
          <div
            style={{
              borderRadius: 8,
              border: '0px solid #f0f0f0',
              marginBottom: children ? 16 : 0,
              width: '100%',
            }}
          >
            <NoteEditor key={editorKey} {...resolvedEditorProps} />
          </div>
        )}
        {children}
      </div>
      {footer ? <div style={{ marginTop: 16 }}>{footer}</div> : null}
    </Modal>
  );
};

export default DocumentEditorModal;
