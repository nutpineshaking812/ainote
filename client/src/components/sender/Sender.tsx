import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import { Button, Flex, GetRef, Popover, Space, Tag } from 'antd';
import { Sender } from '@ant-design/x';
import { SlotConfigType } from '@ant-design/x/es/sender/interface';
import SnippetsOutlined from '@ant-design/icons/lib/icons/SnippetsOutlined';
import { PictureOutlined, LoadingOutlined, CloseCircleOutlined } from '@ant-design/icons';
import ReferencePicker, { ReferencePickerHandle } from './ReferencePicker';
import { uploadImage } from '../../api/upload';

export type SelectionToken = {
  key: string;
  label: string;
  removable: boolean;
  type: 'reference' | 'template' | 'prompt' | 'document' | string;
  value: string;
};

export type SenderComponentProps = {
  appId?: string;
  placeholder?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  disabled?: boolean;
  autoSize?: { minRows?: number; maxRows?: number };
  displayMode?: 'inline' | 'header';
  suggestionsStyle?: React.CSSProperties;
  initialSelectionTokens?: SelectionToken[];
  onKeyDown?: React.KeyboardEventHandler<any>;
  onChange?: (value: string, event?: any, tokens?: SelectionToken[]) => void;
  onSubmit?: (message: string | any[], tokens?: SelectionToken[]) => void;
  loading?: boolean;
  onCancel?: () => void;
};

export const SenderComponent = forwardRef<any, SenderComponentProps>((props, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const senderRef = useRef<GetRef<typeof Sender> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<
    { uid: string; name: string; url: string; status: 'uploading' | 'done' | 'error' }[]
  >([]);

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    for (const file of fileList) {
      const tempUid = Math.random().toString(36).substring(2, 9);
      setImages((prev) => [
        ...prev,
        { uid: tempUid, name: file.name, url: '', status: 'uploading' },
      ]);
      try {
        const uploaded = await uploadImage(file);
        setImages((prev) =>
          prev.map((img) =>
            img.uid === tempUid ? { ...img, url: uploaded.url, status: 'done' } : img,
          ),
        );
      } catch (err) {
        console.error('Image upload failed:', err);
        setImages((prev) =>
          prev.map((img) => (img.uid === tempUid ? { ...img, status: 'error' } : img)),
        );
      }
    }
  };

  const removeImage = (uid: string) => {
    setImages((prev) => prev.filter((img) => img.uid !== uid));
  };

  const [containerWidth, setContainerWidth] = useState<number>(520);
  useEffect(() => {
    const update = () => setContainerWidth(containerRef.current?.offsetWidth || 520);
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, []);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerActiveTab, setPickerActiveTab] = useState<'documents' | 'templates'>('templates');
  const [pickerRefreshKey, setPickerRefreshKey] = useState<number>(0);
  const pickerRef = useRef<ReferencePickerHandle | null>(null);

  const isHeaderMode = (props.displayMode || 'inline') === 'header';
  const [headerOpen, setHeaderOpen] = useState<boolean>(isHeaderMode);
  const [referenceTokens, setReferenceTokens] = useState<SelectionToken[]>([]);

  const popoverOverlayStyle = useMemo(
    () => ({
      width: containerWidth || 520,
      padding: 0,
      ...(props.suggestionsStyle || {}),
    }),
    [containerWidth, props.suggestionsStyle],
  );

  // Initialize tokens from props when provided
  useEffect(() => {
    const tokens = props.initialSelectionTokens || [];
    if (tokens.length > 0) {
      const next = clampPromptTemplateTokens(tokens);
      setReferenceTokens(next);
      if (isHeaderMode && !headerOpen) setHeaderOpen(true);
    }
  }, [props.initialSelectionTokens, isHeaderMode]);

  const openPicker = (tab?: 'documents' | 'templates') => {
    if (tab) setPickerActiveTab(tab);
    setPickerOpen(true);
    setPickerRefreshKey((k) => k + 1);
    // Focus the picker to enable keyboard navigation
    setTimeout(() => pickerRef.current?.focus(), 0);
  };
  const closePicker = () => {
    setPickerOpen(false);
    senderRef.current?.focus({ cursor: 'end' });
  };

  useImperativeHandle(ref, () => ({
    clear: () => {
      clearSlotContent();
    },
    insert: (item: string) => {
      insertTextSlotContent(item);
    },
    openFileSelector: () => {
      openPicker('documents');
    },
    openTemplateSelector: () => {
      openPicker('templates');
    },
    getValue: () => {
      return senderRef.current?.getValue();
    },
    focus: () => {
      senderRef.current?.focus({ cursor: 'end' });
    },
  }));

  const clampPromptTemplateTokens = (tokens: SelectionToken[]) => {
    // Preserve original order while keeping only the last prompt token
    const lastPromptIndex = tokens.reduce((idx, t, i) => (t.type === 'prompt' ? i : idx), -1);
    if (lastPromptIndex === -1) return tokens;
    return tokens.filter((t, i) => t.type !== 'prompt' || i === lastPromptIndex);
  };

  const insertTextSlotContent = (item: string) => {
    senderRef.current?.insert(
      [
        {
          type: 'text',
          value: item + ' ',
        },
      ],
      'cursor',
    );
  };

  const emitReferenceChange = (tokens: SelectionToken[] = referenceTokens) => {
    if (!props.onChange) return;
    const state = senderRef.current?.getValue();
    props.onChange(state?.value ?? '', undefined, tokens);
  };

  const upsertReferenceToken = (token: SelectionToken) => {
    if (isHeaderMode && !headerOpen) {
      setHeaderOpen(true);
    }
    setReferenceTokens((prev) => {
      const next = clampPromptTemplateTokens([...prev.filter((t) => t.key !== token.key), token]);
      if (isHeaderMode) emitReferenceChange(next);
      return next;
    });
  };

  const removeReferenceToken = (key: string) => {
    setReferenceTokens((prev) => {
      const next = prev.filter((token) => token.key !== key);
      if (isHeaderMode) emitReferenceChange(next);
      return next;
    });
  };

  const insertTagSlotContent = (
    key: string,
    label: string,
    value: string,
    extraProps: Record<string, any> = {},
  ) => {
    insertTextSlotContent('');
    senderRef.current?.insert(
      [
        {
          type: 'tag',
          key: key,
          props: { label: `@${label}`, value: value, ...extraProps },
        },
      ],
      'cursor',
    );
    const removable =
      typeof extraProps.removable === 'boolean' ? extraProps.removable : key.startsWith('file-');
    const type = extraProps.category || 'reference';
    upsertReferenceToken({ key, label, removable, type, value });
  };

  const clearReferences = () => {
    setReferenceTokens((prevTokens) => {
      const nextTokens = prevTokens.filter((token) => !token.removable);
      if (isHeaderMode) {
        emitReferenceChange(nextTokens);
      }
      return nextTokens;
    });
  };

  const clearSlotContent = () => {
    if (senderRef.current) {
      senderRef.current.clear();
    }
    clearReferences();
    setImages([]);
  };

  const updateSlotContent = (items?: SlotConfigType[]) => {
    if (senderRef.current) {
      senderRef.current.clear();
      if (items && items.length > 0) {
        senderRef.current.insert(items);
      }
    }
  };

  const trimLastSlotContent = (trimValue: string) => {
    if (senderRef.current) {
      const config = senderRef.current
        .getValue()
        .slotConfig.filter((item) => item.type !== 'text' || item.value !== '');
      if (config.length > 0) {
        const lastItem = config[config.length - 1];
        if (lastItem.type === 'text') {
          let currentValue = lastItem.value as string;
          if (currentValue.endsWith(trimValue)) {
            currentValue = currentValue.slice(0, -trimValue.length);
          }
          if (currentValue === '') {
            config.pop();
          } else {
            lastItem.value = currentValue;
          }
        }
      }
      updateSlotContent(config);
    }
  };

  const handleFileSelect = (file: any) => {
    console.log('Selected file:', file);
    const text = file.title;
    trimLastSlotContent('@');
    if (isHeaderMode) {
      upsertReferenceToken({
        key: `file-${file._id}`,
        label: `${text}` || '引用文档',
        removable: true,
        type: 'reference',
        value: `${file._id}`,
      });
    } else {
      insertTagSlotContent(`file-${file.id}`, `${file.name || ''}`, `[文档Id: ${file.id}]`, {
        removable: true,
        category: 'document',
      });
    }
    closePicker();
  };

  const handleTemplateSelect = (template: any) => {
    console.log('Selected template:', template);
    trimLastSlotContent('@');
    const templateLabel = template?.name || '系统提示语';
    const templateValue = template?._id;
    if (isHeaderMode) {
      const referenceItem: SelectionToken = {
        key: `template-${templateValue}`,
        label: templateLabel,
        removable: true,
        type: 'prompt',
        value: `${templateValue}`,
      };
      upsertReferenceToken(referenceItem);
      const value = senderRef.current?.getValue().value || '';
      if (value === '') {
        insertTextSlotContent(`请严格根据「${templateLabel}」中的要求整理当前文档。`);
      }
      // props.onSubmit &&
      //   props.onSubmit(`请严格根据「${templateLabel}」中的要求整理当前文档`, [
      //     ...referenceTokens,
      //     referenceItem,
      //   ]);
      // clearSlotContent();
    } else {
      insertTagSlotContent(
        `template-${templateValue}`,
        templateLabel,
        `[模版Id: ${templateValue}]`,
        {
          removable: false,
          category: 'prompt',
        },
      );
    }
    closePicker();
  };

  const removeToken = (key: string) => {
    removeReferenceToken(key);
    if (isHeaderMode || !senderRef.current) return;
    const current = senderRef.current.getValue().slotConfig;
    const filtered = current.filter(
      (item: SlotConfigType) => !(item.type === 'tag' && item.key === key),
    );
    updateSlotContent(filtered);
  };

  const renderExtensionReferences = () => {
    if (!isHeaderMode || referenceTokens.length === 0) {
      return null;
    }
    return (
      <Flex className="sender-extension-reference-row" gap={6} wrap>
        <Space size={4} wrap>
          {referenceTokens.map((token) => (
            <Tag
              key={token.key}
              color={token.type === 'prompt' ? 'purple' : 'blue'}
              closable={token.removable}
              onClose={(e) => {
                e.preventDefault();
                if (!token.removable) return;
                removeToken(token.key);
              }}
              className="ai-ref-doc-pill"
            >
              {token.type === 'prompt' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <SnippetsOutlined style={{ fontSize: 12 }} />
                  <span style={{ fontWeight: 'bold' }}>{token.label}</span>
                </span>
              ) : (
                token.label
              )}
            </Tag>
          ))}
        </Space>
      </Flex>
    );
  };

  const renderHeader = () => {
    const mode = props.displayMode || 'inline';
    if (mode !== 'header') {
      return null;
    }
    return (
      <Sender.Header
        open={headerOpen}
        closable={false}
        onOpenChange={(nextOpen) => {
          setHeaderOpen(nextOpen);
          if (!nextOpen) {
            clearReferences();
          }
        }}
        title={renderExtensionReferences()}
      ></Sender.Header>
    );
  };

  const referenceSuffixButton = (
    <Button
      type="text"
      size="small"
      icon={<SnippetsOutlined />}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openPicker();
      }}
    >
      发送
    </Button>
  );

  const mergedSuffix = props.suffix ? (
    <Space size={6} align="center">
      {props.suffix}
      {referenceSuffixButton}
    </Space>
  ) : null;

  const handleEditorKeyDown: React.KeyboardEventHandler<any> = (e) => {
    if (e.key === '@') {
      openPicker();
    }
    if (e.key === 'Escape' && pickerOpen) {
      closePicker();
    }
    props.onKeyDown && props.onKeyDown(e);
  };

  const isUploadingImage = images.some((img) => img.status === 'uploading');

  const customPrefix = (
    <Space size={4}>
      {props.prefix}
      <Button
        type="text"
        icon={isUploadingImage ? <LoadingOutlined /> : <PictureOutlined />}
        disabled={props.disabled || isUploadingImage}
        onClick={() => fileInputRef.current?.click()}
        style={{ color: 'rgba(0, 0, 0, 0.45)' }}
      />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        multiple
        onChange={handleUploadImage}
        style={{ display: 'none' }}
      />
    </Space>
  );

  const headerNode = renderHeader();

  return (
    <Popover
      open={pickerOpen}
      trigger="click"
      placement="top"
      destroyOnHidden
      arrow={false}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closePicker();
        }
      }}
      styles={{
        content: {
          display: 'flex',
          flexDirection: 'column',
          // padding: 0,
        },
        root: popoverOverlayStyle,
      }}
      style={{
        borderRadius: 0,
        padding: 0,
      }}
      getPopupContainer={() => containerRef.current || document.body}
      content={
        <ReferencePicker
          ref={pickerRef}
          appId={props.appId}
          onSelectDocument={handleFileSelect}
          onSelectTemplate={handleTemplateSelect}
          activeTabKey={pickerActiveTab}
          onActiveTabChange={(key: string) =>
            setPickerActiveTab(key === 'templates' ? 'templates' : 'documents')
          }
          refreshKey={pickerRefreshKey}
          onClose={closePicker}
        />
      }
    >
      <div ref={containerRef} style={{ width: '100%' }}>
        {images.length > 0 && (
          <div
            className="sender-image-previews"
            style={{
              display: 'flex',
              gap: 8,
              padding: '8px 12px',
              border: '1px solid #f0f0f0',
              borderBottom: 'none',
              background: '#fafafa',
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
              flexWrap: 'wrap',
            }}
          >
            {images.map((img) => (
              <div
                key={img.uid}
                style={{
                  position: 'relative',
                  width: 56,
                  height: 56,
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: '1px solid #d9d9d9',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {img.status === 'uploading' ? (
                  <LoadingOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                ) : img.status === 'error' ? (
                  <span style={{ fontSize: 10, color: '#f5222d', textAlign: 'center', padding: 2 }}>
                    失败
                  </span>
                ) : (
                  <img
                    src={img.url}
                    alt={img.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
                <Button
                  type="text"
                  size="small"
                  shape="circle"
                  icon={<CloseCircleOutlined style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14 }} />}
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 20,
                    height: 20,
                    minWidth: 20,
                    padding: 0,
                    background: '#fff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                  onClick={() => removeImage(img.uid)}
                />
              </div>
            ))}
          </div>
        )}
        <Sender
          ref={senderRef}
          header={headerNode}
          onKeyDown={handleEditorKeyDown}
          onChange={(nextValue) => {
            props.onChange && props.onChange(nextValue, undefined, referenceTokens);
          }}
          placeholder={props.placeholder || '请输入内容，@引用文档或模版'}
          prefix={customPrefix}
          suffix={mergedSuffix}
          disabled={props.disabled}
          autoSize={props.autoSize || { minRows: 1, maxRows: 3 }}
          slotConfig={[]}
          loading={props.loading}
          onCancel={props.onCancel}
          onSubmit={(message: string) => {
            const doneUrls = images.filter((img) => img.status === 'done').map((img) => img.url);
            let payload: any[] = [];
            if (doneUrls.length > 0) {
              if (message.trim()) {
                payload.push({ type: 'text', text: message });
              }
              doneUrls.forEach((url) => {
                payload.push({ type: 'image_url', image_url: { url } });
              });
            } else {
              payload = [{ type: 'text', text: message }];
            }
            props.onSubmit && props.onSubmit(payload, referenceTokens);
            clearSlotContent();
          }}
          style={{ borderRadius: 0, borderStyle: 'none' }}
        />
      </div>
    </Popover>
  );
});

export default SenderComponent;
