import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button, Space, Spin, Typography, Divider, Modal, message, Card, Empty } from 'antd';
import {
  EditOutlined,
  DatabaseOutlined,
  SendOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getForm } from '../../../api/forms';
import { submitFormData } from '../../../api/data';
import FormRenderer from '../../../components/FormRenderer';
import UserAvatarDropdown from '../../../components/UserAvatarDropdown';
import resourceEventBus from '../../../pages/app-detail/utils/resourceEventBus';
import { useAppResources } from '../../../pages/app-detail/context/AppResourcesContext.jsx';
import '../../../components/ResourcePanel.css';
import Permission from '../../../components/Permission';
import ResourcePanelHeader from '../../../pages/app-detail/components/ResourcePanelHeader';
import PermissionGuard from '../../../components/PermissionGuard';
import { APP_PERMISSIONS } from '../../../constants/permissions';
import EmptyPage from '../../../components/EmptyPage';

const { Text } = Typography;

/**
 * FormResourcePanel - 主面板组件
 */
export default function FormResourcePanel({ appId, resource, onAfterDelete }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { siderCollapsed, setSiderCollapsed, hasAppPermission, deleteResource } = useAppResources();
  const [formDetails, setFormDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [draftInitialValues, setDraftInitialValues] = useState({});

  const canFillForm = hasAppPermission(APP_PERMISSIONS.FORM_FILL);

  // 加载草稿逻辑
  useEffect(() => {
    if (resource?.id && canFillForm) {
      try {
        const savedDraft = localStorage.getItem(`draft_${resource.id}`);
        if (savedDraft) {
          setDraftInitialValues(JSON.parse(savedDraft));
          message.info(t('formResourcePanel.draftLoaded'));
        } else {
          setDraftInitialValues({});
        }
      } catch (error) {
        console.error('Error loading draft from local storage:', error);
      }
    }
  }, [resource?.id, canFillForm, t]);

  // 加载表单详情逻辑
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const resourceId = resource?.id;
      // 如果没有填写权限，或者已经加载过该表单，则不重复请求
      if (!resourceId || resource?.type !== 'form' || !canFillForm) {
        if (!resourceId || !canFillForm) setFormDetails(null);
        return;
      }

      // 如果当前表单详情已经是该 ID，且不是在加载中，则跳过
      if (formDetails?._id === resourceId) {
        return;
      }

      try {
        setLoading(true);
        const details = await getForm(appId, resourceId);
        if (!cancelled) setFormDetails(details);
      } catch (e) {
        if (!cancelled) {
          setFormDetails(null);
          message.error(t('formResourcePanel.loadFailed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [appId, resource?.id, resource?.type, canFillForm]); // 使用原始值作为依赖，避免对象身份变化触发

  const handleSaveDraft = useCallback(
    (values) => {
      if (!resource || resource.id === undefined) return;
      try {
        localStorage.setItem(`draft_${resource.id}`, JSON.stringify(values));
        message.success(t('formResourcePanel.draftSaved'));
      } catch (error) {
        console.error('Error saving draft to local storage:', error);
        message.error(t('formResourcePanel.saveDraftFailed'));
      }
    },
    [resource, t],
  );

  const handleSubmit = async (formData) => {
    if (!resource || resource.id === undefined) return;
    try {
      await submitFormData(resource.id, { data: formData });
      message.success(t('formResourcePanel.submitSuccess'));
      localStorage.removeItem(`draft_${resource.id}`);
      setDraftInitialValues({});
    } catch (e) {
      message.error(e.message || t('formResourcePanel.submitFailed'));
      throw e;
    }
  };

  const handleDelete = async () => {
    if (!resource) return;
    Modal.confirm({
      title: t('formResourcePanel.deleteFormTitle'),
      icon: <ExclamationCircleOutlined />,
      content: t('formResourcePanel.deleteFormContent'),
      okType: 'danger',
      okText: t('formResourcePanel.delete'),
      cancelText: t('formResourcePanel.cancel'),
      onOk: async () => {
        try {
          const success = await deleteResource('form', resource._id || resource.id);
          if (success) {
            resourceEventBus.emit('resource:deleted', {
              type: 'form',
              id: resource.id,
              navigateTo: 'clear',
            });
            onAfterDelete?.(resource.id);
          }
        } catch (e) {
          message.error(e.message || t('formResourcePanel.deleteFailed'));
        }
      },
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <ResourcePanelHeader
        breadcrumbItems={[{ title: t('formResourcePanel.enterData') }]}
        siderCollapsed={siderCollapsed}
        setSiderCollapsed={setSiderCollapsed}
        extraActions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Permission require={APP_PERMISSIONS.FORM_DESIGN} scope="app">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ fontSize: '15px' }} />}
                disabled={!formDetails}
                onClick={() => navigate(`/apps/${appId}/forms/${resource.id}#/edit`)}
              >
                {t('formResourcePanel.edit')}
              </Button>
            </Permission>

            <Permission
              requireAny={[
                APP_PERMISSIONS.FORM_DESIGN,
                APP_PERMISSIONS.FORM_PUBLISH,
                APP_PERMISSIONS.FORM_VIEW,
              ]}
              scope="app"
            >
              <Button
                type="text"
                size="small"
                icon={<DatabaseOutlined style={{ fontSize: '15px' }} />}
                disabled={!formDetails}
                onClick={() => navigate(`/apps/${appId}/forms/${resource.id}#/data`)}
              >
                {t('formResourcePanel.dataManagement')}
              </Button>
            </Permission>

            <Permission require={APP_PERMISSIONS.FORM_DESIGN} scope="app">
              <Button
                danger
                type="text"
                size="small"
                style={{ color: '#ff4d4f' }}
                icon={<DeleteOutlined style={{ fontSize: '15px' }} />}
                disabled={!formDetails}
                onClick={handleDelete}
              >
                {t('formResourcePanel.delete')}
              </Button>
            </Permission>
          </div>
        }
      />

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <PermissionGuard
          require={APP_PERMISSIONS.FORM_VIEW}
          fallback={<EmptyPage description="你没有访问该表单的权限" />}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spin size="large" />
            </div>
          ) : formDetails ? (
            <div style={{ maxWidth: 1100, padding: '0 24px 60px 24px', width: '100%' }}>
              <Typography.Title
                level={1}
                style={{
                  marginBottom: 32,
                  fontSize: '32px',
                  fontWeight: 700,
                  color: '#37352f',
                  letterSpacing: '-0.01em',
                }}
              >
                {formDetails.name}
              </Typography.Title>
              <FormRenderer
                form={formDetails}
                onSubmit={handleSubmit}
                onSaveDraft={handleSaveDraft}
                initialValues={draftInitialValues}
                align="left"
                appId={appId}
              />
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#888', marginTop: 80 }}>
              {t('formResourcePanel.selectOrCreateForm')}
            </div>
          )}
        </PermissionGuard>
      </div>
    </div>
  );
}
