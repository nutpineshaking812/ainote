import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Button, Tabs, Modal, Drawer, message } from 'antd';
import {
  ArrowLeftOutlined,
  ShareAltOutlined,
  BellOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import FormBuilderContext from '../../contexts/FormBuilderContext';
import UserAvatarDropdown from '../../components/UserAvatarDropdown';
import { getForm, createForm, updateForm, shareForm } from '../../api/forms';
import DocumentShareModal from '../../features/documents/components/DocumentShareModal';
import InlineEditableTitle from '../../components/InlineEditableTitle.jsx';
import BuilderView from './BuilderView.jsx';
import FormPublishView from './PublishView.jsx';
import DataSetView from './DataSetView.jsx';
import { normalizeFormData } from '../../features/form-builder/utils/normalizeFormData.js';
import { componentRegistry } from '../../features/form-builder/registry';
import FormRenderer from '../../components/FormRenderer.jsx';
import { usePermission } from '../../hooks/usePermission';
import { APP_PERMISSIONS } from '../../constants/permissions';

const TAB_TO_HASH = {
  builder: '#/edit',
  publish: '#/publish',
  data: '#/data',
};

const HASH_TO_TAB = {
  '#/edit': 'builder',
  '#/publish': 'publish',
  '#/data': 'data',
};
const { Header } = Layout;

// FormBuilderPage: minimal page-level layout (header, tabs) and Outlet for nested routes
const FormBuilderPage = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { appId, formId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState(() => {
    const normalizedHash = (location.hash || '').toLowerCase();
    return HASH_TO_TAB[normalizedHash] || 'builder';
  });

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const parentId = queryParams.get('parentId');

  const [headerTitle, setHeaderTitle] = useState(t('formBuilder.formDesigner'));
  const [onHeaderTitleChange, setOnHeaderTitleChange] = useState(null);
  const [formData, setFormData] = useState(null);
  const [isFormLoading, setIsFormLoading] = useState(true);
  const [savedFormData, setSavedFormData] = useState(null);
  const [unsavedPromptVisible, setUnsavedPromptVisible] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { hasAppPermission, loading: permissionLoading } = usePermission(appId);

  // Define available tabs based on permissions
  const availableTabs = useMemo(() => {
    if (permissionLoading) return [];
    const tabs = [];
    if (hasAppPermission(APP_PERMISSIONS.FORM_DESIGN)) {
      tabs.push({ key: 'builder', label: t('formBuilder.formDesign') });
    }
    if (hasAppPermission(APP_PERMISSIONS.FORM_PUBLISH)) {
      tabs.push({ key: 'publish', label: t('formBuilder.formPublish') });
    }
    if (hasAppPermission(APP_PERMISSIONS.FORM_VIEW)) {
      tabs.push({ key: 'data', label: t('formBuilder.dataManagement') });
    }
    return tabs;
  }, [hasAppPermission, permissionLoading, t]);

  useEffect(() => {
    const normalizedHash = (location.hash || '').toLowerCase();
    let nextTab = HASH_TO_TAB[normalizedHash] || 'builder';

    // If active tab is not available, redirect to the first available one
    if (availableTabs.length > 0 && !availableTabs.find((t) => t.key === nextTab)) {
      nextTab = availableTabs[0].key;
    }

    setActiveTab(nextTab);
  }, [appId, formId, location.hash, availableTabs]);

  useEffect(() => {
    const desiredHash = TAB_TO_HASH[activeTab] || '';
    const currentHash = window.location.hash || '';
    if (desiredHash !== currentHash) {
      const { pathname, search } = location;
      navigate(`${pathname}${search}${desiredHash}`, { replace: true });
    }
  }, [activeTab, location, navigate]);

  useEffect(() => {
    let cancelled = false;

    const applyFormData = (form) => {
      if (cancelled) return;
      const normalized = form ? normalizeFormData(form) : null;
      setFormData(normalized);
      setSavedFormData(normalized ? JSON.parse(JSON.stringify(normalized)) : null);
      if (normalized && normalized.name) {
        setHeaderTitle(normalized.name);
      } else if (formId === 'new') {
        setHeaderTitle(t('formBuilder.newForm'));
      } else {
        setHeaderTitle(t('formBuilder.formDesigner'));
      }
      setIsFormLoading(false);
    };

    if (!appId || !formId) {
      applyFormData(null);
      return () => {
        cancelled = true;
      };
    }

    if (formId === 'new') {
      const newFormTemplate = {
        _id: 'new',
        name: t('formBuilder.newForm'),
        fields: [],
        actions: [
          { type: 'submit', label: t('formBuilder.submit') },
          { type: 'save_draft', label: t('formBuilder.saveDraft') },
        ],
      };
      applyFormData(newFormTemplate);
      return () => {
        cancelled = true;
      };
    }

    const loadForm = async () => {
      try {
        const form = await getForm(appId, formId);
        applyFormData(form);
      } catch (error) {
        applyFormData(null);
      }
    };

    setIsFormLoading(true);
    loadForm();

    return () => {
      cancelled = true;
    };
  }, [appId, formId, t]);

  const handleTitleEdit = useCallback(
    (nextValue) => {
      const trimmed = (nextValue || '').trim();
      const finalValue = trimmed || t('formBuilder.newForm');
      setHeaderTitle(finalValue);
      if (typeof onHeaderTitleChange === 'function') {
        onHeaderTitleChange(finalValue);
      }
      setFormData((prev) => {
        if (!prev) return prev;
        return { ...prev, name: finalValue };
      });
    },
    [onHeaderTitleChange, setFormData, t],
  );

  const markFormSaved = useCallback(
    (nextData) => {
      let normalized = null;
      if (nextData) {
        normalized = normalizeFormData(nextData);
        setFormData(normalized);
      } else if (formData) {
        normalized = normalizeFormData(formData);
      }
      setSavedFormData(normalized ? JSON.parse(JSON.stringify(normalized)) : null);
    },
    [formData, setFormData, setSavedFormData],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!formData || !savedFormData) return false;
    try {
      return JSON.stringify(formData) !== JSON.stringify(savedFormData);
    } catch (err) {
      console.warn('Failed to evaluate unsaved changes', err);
      return false;
    }
  }, [formData, savedFormData]);

  const sanitizeFieldForSave = useCallback((field) => {
    if (!field || typeof field !== 'object') {
      return field;
    }
    const cleanedProps = { ...(field.properties || {}) };
    ['required', 'pattern', 'min', 'max'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(cleanedProps, key)) {
        delete cleanedProps[key];
      }
    });
    const v = field.validation || {};
    const cleanedValidation = {};
    Object.entries(v).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      if (key === 'required') {
        if (value === true) {
          cleanedValidation.required = true;
        }
        return;
      }
      if ((key === 'min' || key === 'max') && typeof value === 'number') {
        cleanedValidation[key] = value;
        return;
      }
      if (key === 'pattern') {
        if (typeof value === 'string' && value) {
          cleanedValidation.pattern = value;
        }
        return;
      }
      cleanedValidation[key] = value;
    });
    const plugin = componentRegistry.get(field.type);
    const resolvedRecordable = (() => {
      if (field.recordable === false) return false;
      if (field.recordable === true) return true;
      return plugin?.recordable === false ? false : true;
    })();
    return {
      ...field,
      recordable: resolvedRecordable,
      properties: cleanedProps,
      validation: cleanedValidation,
    };
  }, []);

  const performSave = useCallback(
    async ({ redirect = false } = {}) => {
      if (!formData) {
        message.warning(t('formBuilder.formNotLoaded'));
        return false;
      }
      const fields = Array.isArray(formData.fields) ? formData.fields : [];
      const normalizedFields = fields.map(sanitizeFieldForSave);
      const payload = { ...formData, fields: normalizedFields };
      try {
        setIsSaving(true);
        let persisted;
        if (formId === 'new') {
          persisted = await createForm(appId, { ...payload, parentId });
          message.success(t('formBuilder.formCreatedSuccess'));
        } else {
          persisted = await updateForm(appId, formId, payload);
          message.success(t('formBuilder.formSavedSuccess'));
        }
        const snapshot = persisted || payload;
        markFormSaved(snapshot);
        if (!redirect && formId === 'new' && persisted && (persisted._id || persisted.id)) {
          const newFormId = persisted._id || persisted.id;
          const currentHash = location.hash || '';
          navigate(`/apps/${appId}/forms/${newFormId}${currentHash}`, { replace: true });
        }
        if (redirect) {
          const rawTargetId = (persisted && (persisted._id || persisted.id)) || formId;
          const targetFormId = rawTargetId && rawTargetId !== 'new' ? rawTargetId : undefined;
          navigate({
            pathname: `/apps/${appId}`,
            hash: targetFormId ? `#/form/${targetFormId}` : '',
          });
        }
        return true;
      } catch (err) {
        message.error(t('formBuilder.saveFailed'));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [formData, sanitizeFieldForSave, formId, appId, markFormSaved, navigate, location.hash, t],
  );

  const handleShareSave = useCallback(
    async (id, shares) => {
      await shareForm(appId, id, shares);
      setFormData((prev) => (prev ? { ...prev, shares } : prev));
    },
    [appId],
  );

  const navigateToAppDetail = useCallback(() => {
    const resolvedId = formId === 'new' ? formData && (formData._id || formData.id) : formId;
    const targetFormId = resolvedId && resolvedId !== 'new' ? resolvedId : undefined;
    navigate({ pathname: `/apps/${appId}`, hash: targetFormId ? `#/form/${targetFormId}` : '' });
  }, [navigate, appId, formId, formData]);

  const handleBackClick = useCallback(() => {
    if (hasUnsavedChanges) {
      setUnsavedPromptVisible(true);
    } else {
      navigateToAppDetail();
    }
  }, [hasUnsavedChanges, navigateToAppDetail]);

  const handleSaveAndExit = useCallback(() => {
    performSave({ redirect: true }).then((success) => {
      if (!success) {
        setUnsavedPromptVisible(true);
      } else {
        setUnsavedPromptVisible(false);
      }
    });
  }, [performSave]);

  const handleDiscardAndExit = useCallback(() => {
    if (savedFormData) {
      markFormSaved(savedFormData);
    } else {
      markFormSaved(null);
    }
    setUnsavedPromptVisible(false);
    navigateToAppDetail();
  }, [markFormSaved, savedFormData, navigateToAppDetail]);

  const handleContinueEditing = useCallback(() => {
    setUnsavedPromptVisible(false);
  }, []);

  const contextValue = {
    setHeaderTitle,
    headerTitle,
    setHeaderTitleChangeHandler: setOnHeaderTitleChange,
    formData,
    setFormData,
    formLoading: isFormLoading,
    markFormSaved,
    hasUnsavedChanges,
  };
  const canSaveForm = !isFormLoading && Boolean(formData) && !isSaving;
  const canPreview = activeTab === 'builder' && !isFormLoading && Boolean(formData);
  const canSave = activeTab === 'builder' && canSaveForm;

  const renderActiveView = () => {
    switch (activeTab) {
      case 'publish':
        return <FormPublishView />;
      case 'data':
        return <DataSetView />;
      case 'builder':
      default:
        return <BuilderView />;
    }
  };

  return (
    <FormBuilderContext.Provider value={contextValue}>
      <Layout style={{ height: '100vh', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ArrowLeftOutlined
              onClick={handleBackClick}
              style={{ marginRight: '16px', cursor: 'pointer' }}
            />
            <InlineEditableTitle
              value={headerTitle}
              defaultValue={t('formBuilder.newForm')}
              onChange={handleTitleEdit}
            />
          </div>

          <div
            style={{
              flexGrow: 1,
              width: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end',
              paddingBottom: 0,
              lineHeight: '1',
              height: '100%',
            }}
          >
            <Tabs
              activeKey={activeTab}
              onChange={(key) => {
                setActiveTab(key);
              }}
              size="large"
              tabBarStyle={{ fontSize: 15, fontWeight: 500, margin: 0 }}
              items={availableTabs}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              justifyContent: 'flex-end',
            }}
          >
            <Button onClick={() => setIsPreviewVisible(true)} disabled={!canPreview}>
              {t('formBuilder.preview')}
            </Button>
            <Button
              type="primary"
              onClick={() => performSave()}
              loading={isSaving}
              disabled={!canSave}
            >
              {t('formBuilder.save')}
            </Button>
            {/* <Button
              icon={<ShareAltOutlined />}
              onClick={() => setShareModalVisible(true)}
              disabled={formId === 'new'}
            >
              {t('formBuilder.share')}
            </Button> */}
            <BellOutlined />
            <QuestionCircleOutlined />
            <UserAvatarDropdown />
          </div>
        </Header>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '0',
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          <div style={{ flexGrow: 1, display: 'flex', height: '100%', minWidth: 0 }}>
            {renderActiveView()}
          </div>
        </div>

        <Modal
          open={unsavedPromptVisible}
          title={t('formBuilder.unsavedChangesTitle')}
          onCancel={handleContinueEditing}
          centered
          maskClosable={false}
          footer={[
            <Button key="continue" onClick={handleContinueEditing}>
              {t('formBuilder.continueEditing')}
            </Button>,
            <Button key="discard" danger onClick={handleDiscardAndExit}>
              {t('formBuilder.discardChanges')}
            </Button>,
            <Button
              key="save"
              type="primary"
              onClick={handleSaveAndExit}
              loading={isSaving}
              disabled={!canSaveForm}
            >
              {t('formBuilder.save')}
            </Button>,
          ]}
        >
          <p>{t('formBuilder.unsavedChangesPrompt')}</p>
        </Modal>
        <Drawer
          title={formData?.name || t('formBuilder.formPreview')}
          open={isPreviewVisible}
          onClose={() => setIsPreviewVisible(false)}
          placement="bottom"
          size={600}
          footer={null}
        >
          <FormRenderer
            form={{
              ...(formData || {}),
              fields: Array.isArray(formData?.fields) ? formData.fields : [],
            }}
            appId={appId}
            onSubmit={() => {
              message.success(t('formBuilder.submittedPreview'));
              setIsPreviewVisible(false);
            }}
          />
        </Drawer>
        <DocumentShareModal
          open={shareModalVisible}
          onCancel={() => setShareModalVisible(false)}
          onSave={handleShareSave}
          doc={formData}
          title={t('formBuilder.shareFormTitle')}
        />
      </Layout>
    </FormBuilderContext.Provider>
  );
};

export default FormBuilderPage;
