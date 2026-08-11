import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Space,
  Button,
  Spin,
  message,
  Breadcrumb,
  Modal,
  Switch,
  Tooltip,
  Badge,
  Splitter,
  Skeleton,
  Input,
  Select,
  Checkbox,
  Tag,
} from 'antd';
import {
  AuditOutlined,
  SaveOutlined,
  HistoryOutlined,
  BuildOutlined,
  MenuUnfoldOutlined,
  EyeOutlined,
  FormOutlined,
  ThunderboltOutlined,
  CloudUploadOutlined,
  ShareAltOutlined,
  TagsOutlined,
  CalendarOutlined,
  PlusOutlined,
  DeleteOutlined,
  SettingOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import Permission from '../../../components/Permission';
import ResourcePanelHeader from '../../../pages/app-detail/components/ResourcePanelHeader';
import PermissionGuard from '../../../components/PermissionGuard';
import { getDocumentWithChildren, updateDocument, shareDocument } from '../../../api/documents';
import DocumentShareModal from './DocumentShareModal';
import NoteEditor from '../../../components/blocknote/NoteEditor';
import { AgentDockProvider } from '../../chat/context/AgentDockContext';
import { AgentDock } from '../../chat/components/AgentDock';
import { AgentWorkspace } from '../../chat/components/AgentWorkspace';
import { EMPLOYEE_SCENARIOS } from '../../../constants/employee';

import resourceEventBus from '../../../pages/app-detail/utils/resourceEventBus';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppResources } from '../../../pages/app-detail/context/AppResourcesContext.jsx';
import { useResourceTree } from '../../resource-tree/context/ResourceTreeContext.jsx';
import TemplateCenterDrawer from './TemplateCenterDrawer';
import AIPromptManager from '../../../components/AIPromptManager';
import { listConversations } from '../../../api/conversations.js';
import UserAvatarDropdown from '../../../components/UserAvatarDropdown';
import CategorySelect from '../../../components/common/CategorySelect';
import DocumentPublishMenu from './DocumentPublishMenu';
import DocumentTitleSlot from './DocumentTitleSlot';
import DocumentPropertiesDrawer from './DocumentPropertiesDrawer';
import { downloadFile } from '../../../api/files';
import { downloadAndSave } from '../../../utils/fileDownload';
import '../../../components/ResourcePanel.css';

const EDIT_MODE_STORAGE_PREFIX = 'documentResourcePanel.isEditable';
const buildEditModeStorageKey = (docId) => `${EDIT_MODE_STORAGE_PREFIX}.${docId || 'root'}`;

const schemaToParamsList = (schema) => {
  if (!schema || !schema.properties) return [];
  const requiredSet = new Set(schema.required || []);
  return Object.entries(schema.properties).map(([name, prop]) => ({
    name,
    type: prop.type || 'string',
    description: prop.description || '',
    required: requiredSet.has(name),
  }));
};

const paramsListToSchema = (list) => {
  const properties = {};
  const required = [];
  for (const item of list) {
    if (!item.name) continue;
    properties[item.name] = {
      type: item.type,
      description: item.description,
    };
    if (item.required) {
      required.push(item.name);
    }
  }
  return {
    type: 'object',
    properties,
    required,
  };
};

// Panel for browsing a document and its hierarchical child documents
export default function DocumentResourcePanel({ appId, resource }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    createChildDocumentNode,
    siderCollapsed,
    setSiderCollapsed,
    selectedResource,
    tagCategories,
    updateResourceMeta,
    rawResources,
  } = useAppResources();
  // resource.id is refId (Document._id)
  const rootDocId = resource?.id;
  const [currentDocId, setCurrentDocId] = useState(rootDocId);
  const [currentDoc, setCurrentDoc] = useState(null);
  const [childDocs, setChildDocs] = useState([]);
  const [localTags, setLocalTags] = useState(selectedResource?.meta?.categoryKeys || []);

  useEffect(() => {
    setLocalTags(selectedResource?.meta?.categoryKeys || []);
  }, [selectedResource?.meta?.categoryKeys]);

  const [loadingDoc, setLoadingDoc] = useState(false);
  const { getBreadcrumbById, navigateDocument } = useResourceTree();
  const breadcrumb = useMemo(() => {
    try {
      return getBreadcrumbById?.(currentDocId) || [];
    } catch (_) {
      return [];
    }
  }, [getBreadcrumbById, currentDocId]);
  const [saving, setSaving] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  // 本地编辑态，避免修改 currentDoc 触发 BlockNoteEditor 重载
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [dirty, setDirty] = useState(false);

  // Skill states
  const [purpose, setPurpose] = useState('NORMAL');
  const [isSkill, setIsSkill] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [skillParameters, setSkillParameters] = useState({
    type: 'object',
    properties: {},
    required: [],
  });
  const [paramsList, setParamsList] = useState([]);
  const [runTestModalOpen, setRunTestModalOpen] = useState(false);
  const [runTestParams, setRunTestParams] = useState({});

  const initialTitleRef = useRef('');
  const initialBlocksRef = useRef([]);
  const autoSaveTimerRef = useRef(null);
  const lastAutoSaveRef = useRef(0);
  const [autoSaving, setAutoSaving] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const editorRef = useRef(null);
  const [templateCenterOpen, setTemplateCenterOpen] = useState(false);
  const [aiTemplateCenterOpen, setAiTemplateCenterOpen] = useState(false);
  const [editorSeed, setEditorSeed] = useState(0);
  const [assistantDisplayMode, setAssistantDisplayMode] = useState('panel');
  const assistantMinimizedStorageKey = useMemo(
    () => (currentDocId ? `docAssistantMin:${currentDocId}` : null),
    [currentDocId],
  );
  const [assistantMinimized, setAssistantMinimized] = useState(true);
  const getAdaptivePanelSize = useCallback(
    () => (typeof window === 'undefined' ? 420 : Math.min(Math.max(window.innerWidth - 1100, 320), 900)),
    [],
  );
  const [assistantPanelSize, setAssistantPanelSize] = useState(getAdaptivePanelSize);
  const panelManuallyResizedRef = useRef(false);
  const AUTO_SAVE_DELAY = 3000; // ms 输入停止后延时自动保存

  const applyEditableState = useCallback(
    (value) => {
      setIsEditable(value);
      if (typeof window === 'undefined') return;
      const storageKey = buildEditModeStorageKey(currentDocId);
      try {
        localStorage.setItem(storageKey, value ? 'true' : 'false');
      } catch (err) {
        console.warn('Failed to persist edit mode state', err);
      }
    },
    [currentDocId],
  );

  // Load document + direct children (single request)
  useEffect(() => {
    let cancel = false;
    async function loadDocAndChildren(id) {
      if (!id) {
        setCurrentDoc(null);
        setChildDocs([]);
        return;
      }
      try {
        await new Promise((resolve) => setTimeout(resolve, 0));
        setLoadingDoc(true);
        const { doc, children } = await getDocumentWithChildren(appId, id);
        if (cancel) return;
        setCurrentDoc(doc || null);
        setChildDocs(children);
        const docBlocks = Array.isArray(doc?.blocks) ? doc.blocks : [];
        setTitle(doc?.title || '');
        setBlocks(docBlocks);
        initialTitleRef.current = doc?.title || '';
        initialBlocksRef.current = docBlocks;

        // Initialize skill fields
        const docPurpose = doc?.purpose || (doc?.isSkill ? 'SKILL' : 'NORMAL');
        setPurpose(docPurpose);
        const isDocSkill = docPurpose === 'SKILL';
        setIsSkill(isDocSkill);
        setSkillName(doc?.skillName || '');
        setSkillDescription(doc?.description || doc?.skillDescription || '');
        const docParams =
          doc?.parameters || doc?.skillParameters || { type: 'object', properties: {}, required: [] };
        setSkillParameters(docParams);
        setParamsList(schemaToParamsList(docParams));

        setDirty(false);
        setEditorSeed((prev) => prev + 1);
      } catch (e) {
        console.error('Error loading document and children:', e);
        if (!cancel) {
          message.error(t('documentResourcePanel.loadFailed'));
          setCurrentDoc(null);
          setChildDocs([]);
        }
      } finally {
        if (!cancel) setLoadingDoc(false);
      }
    }
    loadDocAndChildren(currentDocId);
    return () => {
      cancel = true;
    };
  }, [currentDocId, appId, t]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsEditable(false);
      return;
    }
    try {
      const stored = localStorage.getItem(buildEditModeStorageKey(currentDocId));
      // 默认情况为 false：如果没有存储值，则开启阅读模式
      if (stored === null) {
        setIsEditable(false);
      } else {
        setIsEditable(stored === 'true');
      }
    } catch (err) {
      console.warn('Failed to read edit mode state', err);
      setIsEditable(false);
    }
  }, [currentDocId]);

  // Reset when resource changes (root selection)
  useEffect(() => {
    if (rootDocId) {
      setCurrentDocId(rootDocId);
    }
  }, [rootDocId]);



  useEffect(() => {
    const handleOpenTemplateCenter = () => setTemplateCenterOpen(true);
    resourceEventBus.on('document:open-template-center', handleOpenTemplateCenter);
    return () => {
      resourceEventBus.off('document:open-template-center', handleOpenTemplateCenter);
    };
  }, []);

  useEffect(() => {
    const handleTrigger = () => {
      setAssistantMinimized(false);
      setAssistantDisplayMode('panel');
    };
    resourceEventBus.on('chat:trigger-workflow', handleTrigger);
    resourceEventBus.on('chat:send-message', handleTrigger);
    return () => {
      resourceEventBus.off('chat:trigger-workflow', handleTrigger);
      resourceEventBus.off('chat:send-message', handleTrigger);
    };
  }, []);

  const assistantPlaceholderKey = useMemo(
    () => (currentDocId ? `doc-thread-${currentDocId}` : 'doc-thread-root'),
    [currentDocId],
  );

  const docTitle = useMemo(
    () => title || currentDoc?.title || t('documentResourcePanel.untitled'),
    [title, currentDoc?.title, t],
  );

  const assistantWelcome = useMemo(
    () => t('documentResourcePanel.assistantWelcome', { docTitle }),
    [docTitle, t],
  );

  const assistantSuggestions = useMemo(() => {
    const docRef = currentDocId || 'root';
    return [
      {
        key: 'doc-summary',
        title: t('documentResourcePanel.summarize'),
        label: t('documentResourcePanel.summarizePrompt', { docTitle }),
        // description: `帮我总结「${docTitle}」的关键要点`,
        payload: t('documentResourcePanel.summarizePrompt', { docTitle }),
        data: {
          action: 'doc_summary',
          docId: docRef,
        },
      },
      {
        key: 'doc-polish',
        title: t('documentResourcePanel.polish'),
        label: t('documentResourcePanel.polishPrompt', { docTitle }),
        // description: `润色并优化「${docTitle}」的排版表现`,
        payload: t('documentResourcePanel.polishPrompt', { docTitle }),
        data: { action: 'doc_polish', docId: docRef },
      },
      {
        key: 'doc-outline',
        title: t('documentResourcePanel.outline'),
        label: t('documentResourcePanel.outlinePrompt', { docTitle }),
        // description: `提炼「${docTitle}」的三级大纲`,
        payload: t('documentResourcePanel.outlinePrompt', { docTitle }),
        data: { action: 'doc_outline', docId: docRef },
      },
    ];
  }, [docTitle, currentDocId, t]);

  const assistantPrompts = assistantSuggestions;
  const assistantQuickTools = assistantSuggestions;

  useEffect(() => {
    if (typeof window === 'undefined') {
      setAssistantMinimized(true);
      return;
    }
    if (!assistantMinimizedStorageKey) {
      setAssistantMinimized(true);
      return;
    }
    try {
      const stored = localStorage.getItem(assistantMinimizedStorageKey);
      setAssistantMinimized(stored === 'false' ? false : true);
    } catch (err) {
      console.warn('Failed to read assistant minimized state', err);
      setAssistantMinimized(true);
    }
  }, [assistantMinimizedStorageKey]);

  useEffect(() => {
    if (!assistantMinimizedStorageKey || typeof window === 'undefined') return;
    try {
      localStorage.setItem(assistantMinimizedStorageKey, assistantMinimized ? 'true' : 'false');
    } catch (err) {
      console.warn('Failed to persist assistant minimized state', err);
    }
  }, [assistantMinimized, assistantMinimizedStorageKey]);

  useEffect(() => {
    setAssistantDisplayMode('panel');
  }, [currentDocId]);

  const loadDocumentAssistantThreads = useCallback(async () => {
    if (!appId) return [];
    try {
      const data = await listConversations(appId, {
        scenario: EMPLOYEE_SCENARIOS.DOCUMENT,
        limit: 50,
      });
      return data.items || [];
    } catch (err) {
      console.error(t('documentResourcePanel.loadAssistantConversationsFailed'), err);
      return [];
    }
  }, [appId, t]);

  const handleAssistantToggle = useCallback(() => {
    if (!appId) {
      message.warning(t('documentResourcePanel.selectAppFirst'));
      return;
    }
    setAssistantMinimized((prev) => {
      const next = !prev;
      if (!next) {
        setAssistantDisplayMode('panel');
        setSiderCollapsed(true);
      }
      return next;
    });
  }, [appId, t, setSiderCollapsed]);

  const handleAssistantMinimizedChange = useCallback((next) => {
    setAssistantMinimized((prev) => (prev === next ? prev : next));
    if (!next) {
      setAssistantDisplayMode('panel');
      setSiderCollapsed(true);
    }
  }, [setSiderCollapsed]);

  const openChild = (child) => {
    if (!child?._id) return;
    setCurrentDocId(child._id);
  };

  const breadcrumbItems = useMemo(() => {
    if (!Array.isArray(breadcrumb) || breadcrumb.length === 0) {
      return [];
    }
    return breadcrumb.map((b, idx) => {
      const isLast = idx === breadcrumb.length - 1;
      const title = b.title || t('documentResourcePanel.untitled');
      if (isLast || !b?.id) {
        return {
          key: b?.id || `crumb-${idx}`,
          title,
        };
      }
      return {
        key: b.id,
        title: (
          <Tooltip title={title} placement="bottom">
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                navigateDocument(b.id);
              }}
              style={{
                display: 'inline-block',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                verticalAlign: 'bottom',
              }}
            >
              {title}
            </a>
          </Tooltip>
        ),
      };
    });
  }, [breadcrumb, navigateDocument, t]);

  const handleTitleChange = useCallback(
    (t) => {
      if (!isEditable) return;
      setTitle(t);
      setDirty(t !== initialTitleRef.current || blocks !== initialBlocksRef.current);
    },
    [blocks, isEditable],
  );

  const handleblocksChange = useCallback(
    (nextBlocks) => {
      if (!isEditable) return;
      setBlocks(nextBlocks);
      const serializedNext = JSON.stringify(nextBlocks || []);
      const serializedInitial = JSON.stringify(initialBlocksRef.current || []);
      setDirty(serializedNext !== serializedInitial);
    },
    [isEditable],
  );

  const handleRestore = useCallback(() => {
    if (!isEditable) return;
    setTitle(initialTitleRef.current);
    setBlocks(initialBlocksRef.current);
    setDirty(false);
    message.info(t('documentResourcePanel.restored'));
  }, [isEditable, t]);

  const handleCreateChildDocument = useCallback(async () => {
    if (!currentDoc?._id) {
      message.warning(t('documentResourcePanel.selectDocumentFirst'));
      return;
    }
    try {
      const docObj = await createChildDocumentNode({ parentId: currentDoc._id });
      if (!docObj?._id) {
        message.error(t('documentResourcePanel.createFailed'));
        return;
      }
      const docId = docObj._id;
      navigate({ pathname: location.pathname, hash: `#/document/${docId}` }, { replace: true });
      resourceEventBus.emit('resource:created', { type: 'document', id: docId, data: docObj });
      message.success(t('documentResourcePanel.childCreated'));
    } catch (err) {
      console.error('create child doc failed', err);
      message.error(err?.message || t('documentResourcePanel.createFailedWithMessage'));
    }
  }, [currentDoc, createChildDocumentNode, navigate, location.pathname, t]);

  const handleTemplateApply = useCallback(
    (template) => {
      if (!template) return;
      if (!isEditable) {
        message.warning(t('documentResourcePanel.enableEditModeForTemplate'));
        return;
      }
      const blocksFromTemplate = Array.isArray(template.blocks) ? template.blocks : [];
      const performApply = () => {
        setBlocks(blocksFromTemplate);
        setCurrentDoc((d) => (d ? { ...d, blocks: blocksFromTemplate } : d));
        setDirty(true);
        setEditorSeed((prev) => prev + 1);
        setTemplateCenterOpen(false);
        message.success(t('documentResourcePanel.templateApplied'));
      };

      if (dirty || initialBlocksRef.current.length > 0) {
        Modal.confirm({
          title: t('documentResourcePanel.overwriteContentTitle'),
          content: t('documentResourcePanel.overwriteContent'),
          okText: t('documentResourcePanel.overwrite'),
          cancelText: t('documentResourcePanel.cancel'),
          onOk: performApply,
        });
      } else {
        performApply();
      }
    },
    [dirty, isEditable, t],
  );

  const handleSave = useCallback(async () => {
    if (!currentDoc?._id || !dirty || !isEditable) return false;
    try {
      setSaving(true);
      const res = await updateDocument(appId, currentDoc._id, {
        title,
        blocks,
        purpose,
        isSkill: purpose === 'SKILL',
        isKnowledge: purpose === 'KNOWLEDGE',
        skillName,
        skillDescription: skillDescription,
        skillParameters,
      });
      const updatedDoc = res.data || res;
      initialTitleRef.current = title;
      initialBlocksRef.current = blocks;
      setDirty(false);
      setCurrentDoc(updatedDoc);
      resourceEventBus.emit('resource:updated', {
        type: 'document',
        id: currentDoc._id,
        data: {
          title,
          meta: {
            ...selectedResource?.meta,
            name: title,
            purpose,
            isSkill: purpose === 'SKILL',
            isKnowledge: purpose === 'KNOWLEDGE',
            skillName,
            skillDescription,
            skillParameters,
          },
        },
      });
      message.success(t('documentResourcePanel.saved'));
      return true;
    } catch (e) {
      console.error(e);
      message.error(t('documentResourcePanel.saveFailed'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    currentDoc,
    title,
    blocks,
    isSkill,
    skillName,
    skillDescription,
    skillParameters,
    dirty,
    isEditable,
    appId,
    selectedResource,
    t,
  ]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const isSave = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's';
      if (!isSave) return;
      e.preventDefault();
      if (!saving) {
        if (typeof autoSaving !== 'undefined' && autoSaving) return;
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, saving, autoSaving]);

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (!dirty || saving || !currentDoc?._id || !isEditable) return;
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!dirty || saving) return;
      setAutoSaving(true);
      try {
        const res = await updateDocument(appId, currentDoc._id, {
          title,
          blocks,
          purpose,
          isSkill: purpose === 'SKILL',
          isKnowledge: purpose === 'KNOWLEDGE',
          skillName,
          skillDescription,
          skillParameters,
        });
        const updatedDoc = res.data || res;
        initialTitleRef.current = title;
        initialBlocksRef.current = blocks;
        setDirty(false);
        setCurrentDoc(updatedDoc);
        lastAutoSaveRef.current = Date.now();
        resourceEventBus.emit('resource:updated', {
          type: 'document',
          id: currentDoc._id,
          data: {
            title,
            meta: {
              ...selectedResource?.meta,
              name: title,
              purpose,
              isSkill: purpose === 'SKILL',
              isKnowledge: purpose === 'KNOWLEDGE',
              skillName,
              skillDescription,
              skillParameters,
            },
          },
        });
      } catch (e) {
        console.error(e);
        message.error(t('documentResourcePanel.autoSaveFailed'));
      } finally {
        setAutoSaving(false);
      }
    }, AUTO_SAVE_DELAY);
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [
    dirty,
    title,
    blocks,
    isSkill,
    skillName,
    skillDescription,
    skillParameters,
    saving,
    currentDoc,
    isEditable,
    appId,
    selectedResource,
    t,
  ]);

  const handleDownloadOriginal = useCallback(async () => {
    const fileId = currentDoc?.originalFileId;
    if (!fileId) return;
    try {
      await downloadAndSave(downloadFile, fileId, currentDoc?.title || 'original_file');
      message.success(t('common.downloadStarted'));
    } catch (error) {
      message.error(error?.message || t('common.downloadFailed'));
    }
  }, [currentDoc, t]);

  const handleToggleEditable = useCallback(
    (checked) => {
      if (!checked && dirty) {
        Modal.confirm({
          title: t('documentResourcePanel.closeEditModeTitle'),
          content: t('documentResourcePanel.closeEditModeContent'),
          okText: t('documentResourcePanel.close'),
          cancelText: t('documentResourcePanel.cancel'),
          onOk: () => applyEditableState(false),
        });
        return;
      }
      applyEditableState(checked);
    },
    [dirty, applyEditableState, t],
  );

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  const assistantDocked = assistantDisplayMode === 'panel';
  const assistantVisibleInPanel = assistantDocked && !assistantMinimized;

  const handleSplitterResize = useCallback(
    (payload) => {
      if (!assistantDocked) return;
      const sizeList = Array.isArray(payload) ? payload : payload?.sizes;
      if (!Array.isArray(sizeList) || sizeList.length < 2) return;
      const nextSize = sizeList[sizeList.length - 1];
      if (typeof nextSize === 'number') {
        if (nextSize <= 50) {
          setAssistantMinimized(true);
        } else if (nextSize > 0) {
          setAssistantPanelSize(nextSize);
          panelManuallyResizedRef.current = true;
        }
      }
    },
    [assistantDocked],
  );

  // 窗口缩放时自适应 AI 面板宽度（用户手动拖拽过则保持手动值）
  useEffect(() => {
    const handleResize = () => {
      if (!panelManuallyResizedRef.current) {
        setAssistantPanelSize(getAdaptivePanelSize());
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getAdaptivePanelSize]);

  const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);
  const localTagsRef = useRef(localTags);
  const [propertiesDrawerOpen, setPropertiesDrawerOpen] = useState(false);

  useEffect(() => {
    localTagsRef.current = localTags;
  }, [localTags]);

  const handleTagsSave = useCallback(
    async (tagsToSave) => {
      if (!selectedResource) return;

      const targetTags = tagsToSave !== undefined ? tagsToSave : localTagsRef.current;
      const originalTags = selectedResource?.meta?.categoryKeys || [];

      // Only save if actually changed
      if (JSON.stringify(originalTags) === JSON.stringify(targetTags)) return;

      try {
        await updateResourceMeta(selectedResource.type, selectedResource.id, {
          categoryKeys: targetTags,
        });
        message.success(t('documentResourcePanel.tagsUpdated'));
      } catch (err) {
        console.error('Update tags failed', err);
        message.error(t('documentResourcePanel.tagsUpdateFailed'));
        // Revert local tags on failure
        const reverted = selectedResource?.meta?.categoryKeys || [];
        setLocalTags(reverted);
        localTagsRef.current = reverted;
      }
    },
    [selectedResource, updateResourceMeta, t],
  );

  const effectiveTags = useMemo(() => {
    if (!selectedResource || !rawResources) return localTags;

    const tagsSet = new Set(localTags || []);
    let currentRes = rawResources.find((r) => r.id === (selectedResource.id || selectedResource._id));

    while (currentRes && currentRes.parentId) {
      const parent = rawResources.find((r) => r.id === currentRes.parentId);
      if (parent) {
        if (parent.meta?.categoryKeys) {
          parent.meta.categoryKeys.forEach((t) => tagsSet.add(t));
        }
        currentRes = parent;
      } else {
        break;
      }
    }
    return Array.from(tagsSet);
  }, [selectedResource, rawResources, localTags]);

  const titleSlot = useMemo(
    () => (
      <DocumentTitleSlot
        doc={currentDoc}
        tags={effectiveTags}
        tagCategories={tagCategories}
        onDownloadOriginal={handleDownloadOriginal}
        onAddTagClick={() => setPropertiesDrawerOpen(true)}
      />
    ),
    [effectiveTags, tagCategories, currentDoc, handleDownloadOriginal],
  );

  const [hasOpenedAssistant, setHasOpenedAssistant] = useState(!assistantMinimized);

  useEffect(() => {
    if (!assistantMinimized) {
      setHasOpenedAssistant(true);
    }
  }, [assistantMinimized]);

  // 当前文档的 AI 上下文引用（会随文档切换动态更新）
  const docInitialReferences = useMemo(
    () => [
      {
        key: 'raw-reference-data',
        label:'当前文档',
        removable: false,
        type: 'document',
        value: currentDocId,
      },
    ],
    [currentDocId, t],
  );

  const assistantPanel =
    appId && currentDoc ? (
      <AgentWorkspace
        appId={appId}
        minimized={assistantMinimized}
        onMinimizedChange={handleAssistantMinimizedChange}
        defaultDisplayMode={assistantDisplayMode}
        onDisplayModeChange={setAssistantDisplayMode}
        initialReferences={docInitialReferences}
      />
    ) : null;

  const handlePurposeChange = useCallback((val) => {
    setPurpose(val);
    setIsSkill(val === 'SKILL');
    setDirty(true);
  }, []);

  const handleSkillNameChange = useCallback((val) => {
    setSkillName(val);
    setDirty(true);
  }, []);

  const handleSkillDescChange = useCallback((val) => {
    setSkillDescription(val);
    setDirty(true);
  }, []);

  const handleParamsListChange = useCallback((newList) => {
    setParamsList(newList);
    setSkillParameters(paramsListToSchema(newList));
    setDirty(true);
  }, []);

  const handleOpenRunTestModal = useCallback(() => {
    const initialParams = {};
    paramsList.forEach((p) => {
      if (p.name) {
        if (p.type === 'boolean') {
          initialParams[p.name] = false;
        } else if (p.type === 'number') {
          initialParams[p.name] = '';
        } else {
          initialParams[p.name] = '';
        }
      }
    });
    setRunTestParams(initialParams);
    setRunTestModalOpen(true);
  }, [paramsList]);

  const handleExecuteRunTest = useCallback(async () => {
    if (!skillName) {
      message.error(t('documentResourcePanel.skillNameRequired', '技能标识不能为空'));
      return;
    }

    if (dirty) {
      message.loading({
        content: t('documentResourcePanel.savingBeforeRun', '正在保存当前配置...'),
        key: 'runTestSave',
      });
      const saveSuccess = await handleSave();
      message.destroy('runTestSave');
      if (!saveSuccess) {
        return;
      }
    }

    const formattedParams = {};
    paramsList.forEach((p) => {
      if (!p.name) return;
      const val = runTestParams[p.name];
      if (p.type === 'number') {
        formattedParams[p.name] = val === '' ? 0 : Number(val) || 0;
      } else if (p.type === 'boolean') {
        formattedParams[p.name] = Boolean(val);
      } else if (p.type === 'array' || p.type === 'object') {
        try {
          formattedParams[p.name] = typeof val === 'string' && val.trim() ? JSON.parse(val) : val;
        } catch (_) {
          formattedParams[p.name] = val;
        }
      } else {
        formattedParams[p.name] = val;
      }
    });

    const userPrompt = `[测试运行技能] 请调用技能 "${skillName}"，输入参数为：\n${JSON.stringify(formattedParams, null, 2)}`;

    resourceEventBus.emit('chat:send-message', {
      message: userPrompt,
    });

    setRunTestModalOpen(false);
    message.success(t('documentResourcePanel.testTriggered', '已发送测试运行指令到协同区'));
  }, [skillName, paramsList, runTestParams, dirty, handleSave, t]);

  return (
    <AgentDockProvider
      appId={appId}
      targetId={currentDocId || 'root'}
      scenario={EMPLOYEE_SCENARIOS.DOCUMENT}
    >
      <>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            background: '#fff',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <ResourcePanelHeader
            breadcrumbItems={breadcrumbItems}
            siderCollapsed={siderCollapsed}
            setSiderCollapsed={setSiderCollapsed}
            lastUpdated={
              currentDoc?.updatedAt
                ? new Date(currentDoc.updatedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : null
            }
            isPrivate={
              !currentDoc?.shares || !currentDoc.shares.some((s) => s.targetType === 'ALL')
            }
            onShare={() => setShareModalOpen(true)}
            extraActions={
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isEditable && dirty && (
                  <Button
                    size="small"
                    onClick={handleSave}
                    loading={saving}
                    style={{ borderRadius: '4px', fontSize: '12px' }}
                  >
                    {t('common.save')}
                  </Button>
                )}
                <div
                  className="mode-switch-container"
                  style={{
                    border: 'none',
                    boxShadow: 'none',
                    background: 'transparent',
                    padding: '0 4px',
                    height: '28px',
                  }}
                >
                  <Tooltip
                    title={
                      isEditable
                        ? t('documentResourcePanel.editModeTooltip')
                        : t('documentResourcePanel.viewModeTooltip')
                    }
                  >
                    <Switch
                      size="small"
                      checked={isEditable}
                      checkedChildren={t('common.edit')}
                      unCheckedChildren={t('common.preview')}
                      onChange={handleToggleEditable}
                    />
                  </Tooltip>
                </div>

                {/* Properties button — icon turns purple when skill is active */}
                <Tooltip title={t('documentResourcePanel.properties', '文档属性')}>
                  <Button
                    size="small"
                    type={propertiesDrawerOpen ? 'default' : 'text'}
                    icon={
                      <SettingOutlined
                        style={{ fontSize: '15px', color: isSkill ? '#722ed1' : undefined }}
                      />
                    }
                    onClick={() => setPropertiesDrawerOpen((v) => !v)}
                    style={{ padding: '4px 8px', color: isSkill ? '#722ed1' : undefined }}
                  >
                    {t('documentResourcePanel.properties', '属性')}
                  </Button>
                </Tooltip>

                {/* Run Test button — visible when document is configured as a skill */}
                {isSkill && (
                  <Tooltip title={t('documentResourcePanel.runSkill', '测试运行该技能')}>
                    <Button
                      size="small"
                      type="text"
                      icon={<PlayCircleOutlined style={{ color: '#52c41a', fontSize: '15px' }} />}
                      onClick={handleOpenRunTestModal}
                      style={{ padding: '4px 8px' }}
                    >
                      {t('documentResourcePanel.run', '运行')}
                    </Button>
                  </Tooltip>
                )}

                {/* Other Actions integrated as subtle icons or buttons */}
                <Permission require="doc:manage" scope="app" loadingFallback={null}>
                  <DocumentPublishMenu
                    resourceId={selectedResource.id || selectedResource._id}
                    documentId={currentDocId}
                    tags={effectiveTags}
                    title={docTitle}
                    getMarkdownContent={async () => await editorRef.current?.exportToMarkdown()}
                  />
                  <Badge
                    color="transparent"
                    offset={[-4, 1]}
                    count={
                      <span className="ai-pill" style={{ pointerEvents: 'none' }}>
                        AI
                      </span>
                    }
                  >
                    <Button
                      size="small"
                      type="text"
                      icon={<ThunderboltOutlined style={{ fontSize: '15px' }} />}
                      onClick={() => setAiTemplateCenterOpen(true)}
                      style={{ padding: '4px 8px' }}
                    >
                      {t('common.template')}
                    </Button>
                  </Badge>
                </Permission>
              </div>
            }
          />

          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {loadingDoc && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.6)',
                  zIndex: 10,
                }}
              >
                <Spin size="large" />
              </div>
            )}

            {currentDoc ? (
              <Splitter style={{ width: '100%', height: '100%' }} onResize={handleSplitterResize}>
                <Splitter.Panel
                  min={420}
                  style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}
                >
                  <div
                    style={{
                      flexGrow: 1,
                      height: '100%',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: 1100,
                        width: '100%',
                        margin: '0 auto',
                        minHeight: '100%',
                        position: 'relative',
                        // padding: '0 24px 60px 24px',
                      }}
                    >
                      <NoteEditor
                        ref={editorRef}
                        key={`block-editor-${currentDoc?._id || 'none'}-${editorSeed}`}
                        appId={appId}
                        initialTitle={currentDoc?.title || ''}
                        title={title}
                        initialBlocks={currentDoc?.blocks || []}
                        onTitleChange={handleTitleChange}
                        onChange={handleblocksChange}
                        height="100%"
                        withTitle
                        titleSlot={titleSlot}
                        childDocs={childDocs}
                        originalFileInfo={currentDoc}
                        readOnly={!isEditable}
                        usageType="document"
                        usageId={currentDoc?._id || currentDocId}
                      />
                    </div>
                  </div>

                  {/* 贴边悬浮 AgentDock 工具栏，点击头像即展开右侧协同面板 */}
                  <AgentDock placement="right" onSelect={() => { setAssistantMinimized(false); setSiderCollapsed(true); }} style={{"bottom": '160px'}} />
                </Splitter.Panel>
                <Splitter.Panel
                  min={assistantDocked && assistantVisibleInPanel ? Math.max(Math.floor(getAdaptivePanelSize() * 0.7), 280) : 0}
                  size={assistantDocked && assistantVisibleInPanel ? undefined : 0}
                  defaultSize={assistantPanelSize}
                  style={{
                    display: 'flex',
                    height: '100%',
                    borderLeft: '1px solid #f2f2f2',
                    overflow: 'hidden',
                    background: '#fff',
                  }}
                >
                  {assistantPanel}
                </Splitter.Panel>
              </Splitter>
            ) : (
              !loadingDoc && (
                <div style={{ textAlign: 'center', color: '#888', marginTop: 80 }}>
                  {t('documentResourcePanel.notFound')}
                </div>
              )
            )}
          </div>
        </div>

        <DocumentShareModal
          open={shareModalOpen}
          onCancel={() => setShareModalOpen(false)}
          doc={currentDoc}
          onSave={async (docId, shares) => {
            await shareDocument(appId, docId, shares);
            if (currentDoc && currentDoc._id === docId) {
              setCurrentDoc((prev) => ({ ...prev, shares }));
            }
          }}
        />
        <TemplateCenterDrawer
          open={templateCenterOpen}
          onClose={() => setTemplateCenterOpen(false)}
          appId={appId}
          onApplyTemplate={handleTemplateApply}
          type="document"
          onCreateDocument={handleCreateChildDocument}
        />
        <AIPromptManager
          open={aiTemplateCenterOpen}
          onClose={() => setAiTemplateCenterOpen(false)}
          appId={appId}
          defaultOnlyApp={false}
        />

        <DocumentPropertiesDrawer
          open={propertiesDrawerOpen}
          onClose={() => setPropertiesDrawerOpen(false)}
          currentDoc={currentDoc}
          localTags={localTags}
          onTagsChange={(val) => {
            setLocalTags(val);
            localTagsRef.current = val;
            if (!isTagsDropdownOpen) handleTagsSave(val);
          }}
          onTagsDropdownOpenChange={(open) => {
            setIsTagsDropdownOpen(open);
            if (!open) handleTagsSave();
          }}
          tagCategories={tagCategories}
          isEditable={isEditable}
          purpose={purpose}
          isSkill={isSkill}
          skillName={skillName}
          skillDescription={skillDescription}
          paramsList={paramsList}
          onPurposeChange={handlePurposeChange}
          onSkillNameChange={handleSkillNameChange}
          onSkillDescChange={handleSkillDescChange}
          onParamsListChange={handleParamsListChange}
        />

        <Modal
          title={t('documentResourcePanel.runTestTitle', '测试运行智能技能')}
          open={runTestModalOpen}
          onOk={handleExecuteRunTest}
          onCancel={() => setRunTestModalOpen(false)}
          okText={t('common.run', '运行')}
          cancelText={t('common.cancel', '取消')}
          width={480}
          destroyOnClose
        >
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 16, fontSize: 13, color: '#666' }}>
              {t(
                'documentResourcePanel.runTestDesc',
                '此操作将发送一个显式指令让协同区中的数字员工调用并测试当前技能：',
              )}
              <strong style={{ color: '#722ed1', marginLeft: 4 }}>{skillName}</strong>
            </div>
            {paramsList.length > 0 ? (
              <div>
                <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 13 }}>
                  {t('documentResourcePanel.testParams', '输入测试参数：')}
                </div>
                {paramsList.map((param, idx) => {
                  if (!param.name) return null;
                  return (
                    <div key={idx} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>
                        <code>{param.name}</code> ({param.type})
                        {param.required && <span style={{ color: 'red' }}> *</span>}
                        {param.description && (
                          <span style={{ color: '#8c8c8c', marginLeft: 8 }}>
                            - {param.description}
                          </span>
                        )}
                      </div>
                      {param.type === 'boolean' ? (
                        <Checkbox
                          checked={runTestParams[param.name] || false}
                          onChange={(e) => {
                            setRunTestParams((prev) => ({
                              ...prev,
                              [param.name]: e.target.checked,
                            }));
                          }}
                        />
                      ) : param.type === 'number' ? (
                        <Input
                          type="number"
                          size="small"
                          value={runTestParams[param.name] ?? ''}
                          onChange={(e) => {
                            setRunTestParams((prev) => ({ ...prev, [param.name]: e.target.value }));
                          }}
                          placeholder="0"
                          style={{ borderRadius: 4 }}
                        />
                      ) : (
                        <Input
                          size="small"
                          value={runTestParams[param.name] || ''}
                          onChange={(e) => {
                            setRunTestParams((prev) => ({ ...prev, [param.name]: e.target.value }));
                          }}
                          placeholder={
                            param.type === 'array' || param.type === 'object'
                              ? 'Enter JSON data...'
                              : 'Value...'
                          }
                          style={{ borderRadius: 4 }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: '12px',
                  background: '#f5f5f5',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#8c8c8c',
                }}
              >
                {t('documentResourcePanel.noParamsToFill', '当前技能无须输入参数即可运行。')}
              </div>
            )}
          </div>
        </Modal>
      </>
    </AgentDockProvider>
  );
}
