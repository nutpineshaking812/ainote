import React, { useRef, useEffect, useState } from 'react';
import { Typography, Button, Layout } from 'antd';
import './styles/DocumentBreadcrumb.css';
import { useDocumentManager } from './useDocumentManager.js';
import DocumentEditorPanel from './DocumentManager/components/DocumentEditorPanel.jsx';
import UserAvatarDropdown from '../../components/UserAvatarDropdown.jsx';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

// Clean DocumentViewer using Layout.Header / Layout.Content, no close feature.
// Accept precomputed docPath (array of ancestor titles) from parent to avoid extra network calls.
const DocumentViewer = ({
  doc,
  loadChildDocs,
  loading,
  docPath = [],
  docManagerRef,
  updateDocTitle,
  onOpenChild,
}) => {
  // Use external ref if provided so parent can call openById/create/save
  const managerRef = docManagerRef || useRef(null);
  const {
    activeDoc,
    loading: docLoading,
    saving: docSaving,
    dirty: docDirty,
    autoSaveEnabled: docAutoSaveEnabled,
    setTitle: setDocTitle,
    setContent: setDocContent,
    title: docTitle,
    content: docContent,
  } = useDocumentManager({
    appId: doc?.appId ?? doc?.meta?.appId ?? null,
    formId: doc?.formId ?? doc?.meta?.formId ?? null,
    initialDoc: doc || null,
    ref: managerRef,
    onAttachDocId: () => {},
  });

  const [childDocTitles, setChildDocTitles] = React.useState([]);
  // console.log('DocumentViewer render', { doc, activeDoc, docTitle, docContent });
  // console.log('DocumentViewer render', { doc, activeDoc, docTitle, docContent }, docDirty);

  return (
    <Layout style={{ height: '100%', background: '#fff' }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: '#fff',
          height: 64,
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Title
          level={5}
          style={{ margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}
        >
          {doc ? (
            <div
              className="doc-breadcrumb"
              style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}
            >
              {Array.isArray(docPath) &&
                docPath.length > 0 &&
                docPath.map((seg, idx) => {
                  const isLastAncestor = idx === docPath.length - 1;
                  const clickable = !!seg.docId; // only doc ancestors clickable for now
                  return (
                    <span
                      key={seg.key || idx}
                      className="doc-bc-seg-wrapper"
                      style={{ display: 'flex', alignItems: 'center' }}
                    >
                      <span
                        className={`doc-bc-seg ${clickable ? 'clickable' : ''}`}
                        onClick={() => {
                          if (clickable && seg.docId) {
                            if (typeof onOpenChild === 'function') {
                              onOpenChild(seg.docId);
                            } else if (typeof window !== 'undefined') {
                              // fallback
                              window.location.href = `/documents/${seg.docId}`;
                            }
                          }
                        }}
                        title={seg.title}
                      >
                        {seg.title}
                      </span>
                      <span className="doc-bc-sep"> / </span>
                    </span>
                  );
                })}
              <span className="doc-bc-current" title={docTitle || '无标题笔记'}>
                {docTitle || '无标题笔记'}
              </span>
            </div>
          ) : (
            '未选择笔记'
          )}
        </Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {docDirty
              ? '有未保存更改'
              : docAutoSaveEnabled
                ? docContent
                  ? '已保存'
                  : '等待编辑...'
                : '自动保存关闭'}
          </Typography.Text>
          <Button
            size="small"
            type="primary"
            disabled={!docDirty || docSaving || !doc}
            loading={docSaving}
            onClick={() => {
              const prevTitle = activeDoc?.title || docTitle;
              managerRef.current?.save().then((saved) => {
                if (
                  saved &&
                  saved._id &&
                  saved.title !== prevTitle &&
                  typeof updateDocTitle === 'function'
                ) {
                  updateDocTitle(saved._id, saved.title);
                }
              });
            }}
          >
            {t('common.save')}
          </Button>
          <UserAvatarDropdown />
        </div>
      </Layout.Header>

      {/* 实时同步：编辑标题时立即更新树节点标题（未保存时也展示临时标题） */}
      {activeDoc?._id && typeof updateDocTitle === 'function' && (
        <LiveTitleSync
          docId={activeDoc._id}
          activeDocTitle={activeDoc.title}
          currentTitle={docTitle}
          updateDocTitle={updateDocTitle}
        />
      )}
      <Layout.Content
        style={{ display: 'flex', flexDirection: 'column', padding: '12px 16px', minHeight: 0 }}
      >
        {doc ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <DocumentEditorPanel
              appId={doc?.appId ?? doc?.meta?.appId ?? null}
              loading={docLoading}
              title={docTitle}
              content={docContent}
              setTitle={setDocTitle}
              setContent={setDocContent}
              saving={docSaving}
              withTitle={true}
              extraListItems={childDocTitles}
              height="100%"
              usageId={activeDoc?._id || doc?._id}
            />
          </div>
        ) : (
          <div style={{ padding: 48 }}>
            <Typography.Text type="secondary">请选择左侧的笔记开始编辑。</Typography.Text>
          </div>
        )}
      </Layout.Content>
    </Layout>
  );
};

export default DocumentViewer;

const LiveTitleSync = ({ docId, activeDocTitle, currentTitle, updateDocTitle }) => {
  useEffect(() => {
    if (!docId) return;
    if (currentTitle && currentTitle !== activeDocTitle) {
      updateDocTitle(docId, currentTitle);
    }
  }, [docId, currentTitle, activeDocTitle, updateDocTitle]);
  return null;
};
