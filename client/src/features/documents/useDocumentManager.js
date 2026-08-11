import { useState, useCallback, useRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { message, Modal } from 'antd';
import { createDocument, getDocument, updateDocument } from '../../api/documents';

/**
 * Unified useDocumentManager hook
 * Combines base lifecycle (load/create/save) with controller concerns (visibility, dirty tracking, autosave, metrics, shortcuts).
 * Accepts appId/formId scope plus optional onAttachDocId callback and a forwarded ref for imperative API.
 */
function deriveScope(record, appId, formId) {
  return {
    appId: record?.appId ?? record?.meta?.appId ?? appId ?? null,
    formId: record?.formId ?? record?.meta?.formId ?? formId ?? null,
    parentId: record?.parentId ?? record?.parentDocId ?? null,
  };
}

export function useDocumentManager({
  appId,
  formId,
  onAttachDocId,
  ref,
  autosaveDelay = 3000,
  initialDoc = null,
}) {
  // Base document state
  const [activeDoc, setActiveDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState([]);
  const [context, setContext] = useState({
    scope: { appId: appId || null, formId: formId || null, parentId: null },
    recordId: null,
  });

  // Controller/UI state
  const [visible, setVisible] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autoSaveEnabled] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const initialSnapshotRef = useRef({ title: '', content: [] });
  const autoSaveTimerRef = useRef(null);

  // Open (load existing or blank)
  const openForRecord = useCallback(
    async (record = {}) => {
      const scope = deriveScope(record, appId, formId);
      const recordId = record.recordId ?? record._id ?? null;
      setContext({ scope, recordId });
      setLoading(true);
      try {
        const docId =
          record?.docId ||
          (record?.type === 'document' || record?.type === 'document'
            ? record?._id || record?.id || null
            : null) ||
          null;
        if (docId) {
          await loadDocumentById(docId);
        } else {
          setActiveDoc(null);
          setTitle('');
          setContent('');
        }
      } catch (e) {
        message.error('加载笔记失败');
      } finally {
        setLoading(false);
      }
    },
    [appId, formId],
  );

  // Load by explicit document id (centralized logic)
  const loadDocumentById = useCallback(
    async (docId, scopeAppId = null) => {
      if (!docId) return null;
      const effectiveAppId = scopeAppId || appId;
      if (!effectiveAppId) {
        message.error('缺少应用ID');
        return null;
      }
      setLoading(true);
      try {
        const doc = await getDocument(effectiveAppId, docId);
        if (doc) {
          setActiveDoc(doc);
          setTitle(doc.title || '');
          const blocks = Array.isArray(doc.blocks) ? doc.blocks : [];
          setContent(blocks);
          initialSnapshotRef.current = { title: doc.title || '', content: blocks };
          setDirty(false);
          return doc;
        }
      } catch (e) {
        message.error('加载笔记失败');
      } finally {
        setLoading(false);
      }
      return null;
    },
    [appId],
  );

  // Initialize from provided initialDoc (avoids refetch if caller already has doc object)
  useEffect(() => {
    if (!initialDoc) return;
    // Skip if same doc already set
    if (activeDoc && activeDoc._id === initialDoc._id) return;
    setActiveDoc(initialDoc);
    setTitle(initialDoc.title || '');
    const blocks = Array.isArray(initialDoc.blocks) ? initialDoc.blocks : [];
    setContent(blocks);
    // Prepare snapshot & clear dirty
    initialSnapshotRef.current = {
      title: initialDoc.title || '',
      content: blocks,
      __docId: initialDoc._id || '__new__',
    };
    setDirty(false);
    setLoading(false);
    // Ensure visibility so dirty tracking & autosave can work for inline viewer usage
    setVisible(true);
  }, [initialDoc, activeDoc]);

  const createForRecord = useCallback(
    async (record) => {
      await openForRecord(record);
    },
    [openForRecord],
  );

  // Save (create or update)
  const save = useCallback(
    async (options = {}) => {
      const { silent = false } = options;
      if (saving) return null;
      setSaving(true);
      const isCreate = !activeDoc?._id;
      try {
        let resultDoc;
        if (isCreate) {
          const payload = { title, blocks: content, attachments: [], tags: [] };
          const { scope, recordId } = context;
          if (
            scope.parentId !== undefined &&
            scope.parentId !== null &&
            scope.parentId !== -1 &&
            scope.parentId !== 'root'
          ) {
            payload.parentId = scope.parentId;
          }
          const createOptions = {
            appId: scope.appId || undefined,
            formId: scope.formId || undefined,
            recordId: recordId || undefined,
          };
          resultDoc = await createDocument(payload, createOptions);
        } else {
          const effectiveAppId = context.scope.appId || appId;
          if (!effectiveAppId) {
            throw new Error('缺少应用ID');
          }
          resultDoc = await updateDocument(effectiveAppId, activeDoc._id, {
            title,
            blocks: content,
          });
        }
        if (resultDoc) {
          setActiveDoc(resultDoc);
          if (!silent) message.success(isCreate ? '笔记已创建' : '笔记已保存');
          return { doc: resultDoc, created: isCreate };
        }
      } catch (e) {
        if (!silent) message.error('保存失败');
      } finally {
        setSaving(false);
      }
      return null;
    },
    [activeDoc, title, content, saving, context],
  );

  const reset = useCallback(() => {
    setActiveDoc(null);
    setTitle('');
    setContent('');
    setLoading(false);
    setSaving(false);
    setContext({
      scope: { appId: appId || null, formId: formId || null, parentId: null },
      recordId: null,
    });
    setVisible(false);
    setFullscreen(false);
    setDirty(false);
    initialSnapshotRef.current = { title: '', content: '' };
  }, [appId, formId]);

  // Imperative API
  useImperativeHandle(
    ref,
    () => ({
      open: (record) => {
        openForRecord(record);
        setVisible(true);
      },
      // create immediately persists a new blank (or provided title) document and opens it
      create: async (record = {}) => {
        const scope = deriveScope(record, appId, formId);
        const desiredParentId = record.parentId ?? record.parentDocId ?? scope.parentId ?? null;
        const effectiveParentId =
          desiredParentId && desiredParentId !== 'root' ? desiredParentId : null;
        const initialTitle = record.title || '无标题笔记';
        // If a doc is already loading/saving, avoid overlapping create
        if (saving) return null;
        setSaving(true);
        try {
          const payload = { title: initialTitle, blocks: [], attachments: [], tags: [] };
          if (effectiveParentId) payload.parentId = effectiveParentId;
          const created = await createDocument(payload, {
            appId: scope.appId || appId || undefined,
            formId: scope.formId || undefined,
          });
          if (created) {
            setActiveDoc(created);
            setTitle(created.title || '');
            setContent(Array.isArray(created.blocks) ? created.blocks : []);
            initialSnapshotRef.current = {
              title: created.title || '',
              content: Array.isArray(created.blocks) ? created.blocks : [],
              __docId: created._id,
            };
            setDirty(false);
            setContext({
              scope: {
                appId: scope.appId || null,
                formId: scope.formId || null,
                parentId: effectiveParentId,
              },
              recordId: null,
            });
            setVisible(true);
            message.success('笔记已创建');
            return created;
          }
        } catch (e) {
          message.error('创建笔记失败');
        } finally {
          setSaving(false);
        }
        return null;
      },
      openById: async (docId, scopeAppId = null) => {
        const doc = await loadDocumentById(docId, scopeAppId);
        setVisible(true);
        return doc;
      },
      save: async () => {
        const res = await save();
        if (res?.created) onAttachDocId && onAttachDocId(context.recordId, res.doc._id);
        if (res?.doc) {
          setLastSavedAt(res.doc.updatedAt ? new Date(res.doc.updatedAt) : new Date());
          initialSnapshotRef.current = {
            title: title || '',
            content: Array.isArray(content) ? content : [],
            __docId: res.doc._id || '__new__',
          };
          setDirty(false);
        }
      },
      autoSave: async () => {
        const res = await save({ silent: true });
        if (res?.created) onAttachDocId && onAttachDocId(context.recordId, res.doc._id);
        if (res?.doc) {
          initialSnapshotRef.current = {
            title: title || '',
            content: Array.isArray(content) ? content : [],
            __docId: res.doc._id || '__new__',
          };
          setDirty(false);
          setLastSavedAt(res.doc.updatedAt ? new Date(res.doc.updatedAt) : new Date());
        }
      },
      reset: () => {
        reset();
      },
    }),
    [openForRecord, save, reset, onAttachDocId, context.recordId, title, content],
  );

  // Initialize snapshot only when document becomes available & ready (avoid resetting on every edit)
  const prevDocIdRef = useRef(null);
  useEffect(() => {
    const currentId =
      activeDoc?._id ||
      (title || (Array.isArray(content) && content.length > 0) ? '__new__' : null);
    if (visible && !loading) {
      if (currentId && prevDocIdRef.current !== currentId) {
        initialSnapshotRef.current = {
          title: title || '',
          content: Array.isArray(content) ? content : [],
          __docId: currentId,
        };
        setDirty(false);
        prevDocIdRef.current = currentId;
      }
    } else {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    }
  }, [visible, loading, activeDoc?._id]);

  // Dirty detection + autosave scheduling
  useEffect(() => {
    const orig = initialSnapshotRef.current;
    const nextDirty =
      (title || '') !== orig.title ||
      JSON.stringify(Array.isArray(content) ? content : []) !==
        JSON.stringify(Array.isArray(orig.content) ? orig.content : []);
    setDirty(nextDirty);
    const shouldAutosave = !loading && visible && !saving && nextDirty && autoSaveEnabled;
    if (shouldAutosave) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => ref.current?.autoSave(), autosaveDelay);
    } else if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, [title, content, loading, visible, saving, autoSaveEnabled, ref, autosaveDelay]);

  // Cleanup timer
  useEffect(
    () => () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    },
    [],
  );

  // Save shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        ref.current?.save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ref]);

  // Metrics
  const wordCount = useMemo(() => {
    const blocks = Array.isArray(content) ? content : [];
    let words = 0;
    for (const b of blocks) {
      const texts = (b.content || [])
        .map((c) => (typeof c === 'string' ? c : c.text || ''))
        .join(' ');
      words += texts.trim().split(/\s+/).filter(Boolean).length;
    }
    return words;
  }, [content]);
  const charCount = useMemo(() => {
    const blocks = Array.isArray(content) ? content : [];
    let chars = 0;
    for (const b of blocks) {
      const texts = (b.content || [])
        .map((c) => (typeof c === 'string' ? c : c.text || ''))
        .join('');
      chars += texts.length;
    }
    return chars;
  }, [content]);
  const readingTime = useMemo(() => {
    const wpm = 300;
    const minutes = wordCount / wpm;
    return minutes < 1 ? '<1分钟' : Math.ceil(minutes) + '分钟';
  }, [wordCount]);

  const handleClose = () => {
    if (dirty) {
      Modal.confirm({
        title: '未保存的修改',
        content: '当前有未保存修改，确定关闭?',
        okText: '关闭',
        cancelText: '取消',
        onOk: () => {
          setVisible(false);
          setFullscreen(false);
        },
      });
      return;
    }
    setVisible(false);
    setFullscreen(false);
  };

  return {
    // state
    activeDoc,
    activeRecordId: context.recordId,
    loading,
    saving,
    title,
    content,
    fullscreen,
    dirty,
    autoSaveEnabled,
    lastSavedAt,
    visible,
    // setters
    setTitle,
    setContent,
    setFullscreen,
    setVisible,
    // metrics
    wordCount,
    charCount,
    readingTime,
    // actions
    handleClose,
  };
}
