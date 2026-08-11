import React, { forwardRef } from 'react';
import { Drawer } from 'antd';
// Explicit imports to avoid directory/file name ambiguity with Vite
import DocumentHeaderTitle from './DocumentManager/components/DocumentHeaderTitle.jsx';
import DocumentHeaderActions from './DocumentManager/components/DocumentHeaderActions.jsx';
import DocumentEditorPanel from './DocumentManager/components/DocumentEditorPanel.jsx';
import DocumentStatusBar from './DocumentManager/components/DocumentStatusBar.jsx';
import HelpContent from './DocumentManager/components/HelpContent.jsx';
import { useDocumentManager } from './useDocumentManager.js';

/**
 * DocumentManager (Aggregate component)
 * Combines state + UI (drawer) for document lifecycle.
 * Exposes imperative API via ref for parent pages:
 *   ref.current.open(record)
 *   ref.current.create(record, onDocId)
 *   ref.current.save()
 *   ref.current.reset()
 *
 * Props:
 *  appId, formId: scope identifiers
 *  onAttachDocId(recordId, docId): callback when new doc created (parent can update row state)
 */
const DocumentManager = forwardRef(({ appId, formId, onAttachDocId }, ref) => {
  const {
    activeDoc,
    loading,
    saving,
    title,
    content,
    fullscreen,
    dirty,
    autoSaveEnabled,
    lastSavedAt,
    visible,
    setTitle,
    setContent,
    setFullscreen,
    wordCount,
    charCount,
    readingTime,
    handleClose,
  } = useDocumentManager({ appId, formId, onAttachDocId, ref });

  const helpContent = <HelpContent />;

  return (
    <Drawer
      title={
        <DocumentHeaderTitle
          title={title}
          activeDoc={activeDoc}
          onChange={setTitle}
          dirty={dirty}
          saving={saving}
        />
      }
      open={visible}
      placement="right"
      size={fullscreen ? '100%' : 880}
      onClose={handleClose}
      destroyOnClose
      extra={
        <DocumentHeaderActions
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
          saving={saving}
          onSave={() => ref.current?.save()}
          helpContent={helpContent}
        />
      }
      styles={{
        header: {
          borderBottom: '1px solid #f0f0f0',
          paddingBottom: 16,
        },
        body: {
          padding: fullscreen ? '16px 24px' : '20px 24px',
          background: '#fafafa',
        },
      }}
    >
      <div
        style={{
          maxWidth: fullscreen ? '100%' : 820,
          margin: '0 auto',
          background: '#fff',
          borderRadius: 8,
          padding: '24px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <DocumentEditorPanel
          appId={appId}
          loading={loading}
          fullscreen={fullscreen}
          title={title}
          content={content}
          setTitle={setTitle}
          setContent={setContent}
          saving={saving}
          usageId={activeDoc?._id}
        />

        <DocumentStatusBar
          wordCount={wordCount}
          charCount={charCount}
          readingTime={readingTime}
          autoSaveEnabled={autoSaveEnabled}
          dirty={dirty}
          content={content}
          lastSavedAt={lastSavedAt}
        />
      </div>
    </Drawer>
  );
});

export default DocumentManager;
