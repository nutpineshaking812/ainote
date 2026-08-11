import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Space, Input, Button, Alert, Spin, Result, message } from 'antd';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { publicGetForm, publicSubmitForm } from '../../api/publish';
import FormRenderer from '../../components/FormRenderer';
import './PublicFormFillPage.css';
import { DndProvider }
 from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const { Title, Text } = Typography;

// Phases: loading | code | form | error | submitted
const PublicFormFillPage = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { formId } = useParams();
  const [phase, setPhase] = useState('loading');
  const [form, setForm] = useState(null);
  const [accessCode, setAccessCode] = useState(''); // verified code only
  const [codeInput, setCodeInput] = useState(''); // raw input before verification
  const [error, setError] = useState(null); // { type, message }
  const [submitting, setSubmitting] = useState(false);
  const [successRecord, setSuccessRecord] = useState(null);
  const [initialLoadTriedCode, setInitialLoadTriedCode] = useState(false);
  const [draftInitialValues, setDraftInitialValues] = useState({});

  useEffect(() => {
    if (formId) {
      try {
        const savedDraft = localStorage.getItem(`draft_${formId}`);
        if (savedDraft) {
          setDraftInitialValues(JSON.parse(savedDraft));
          message.info(t('publicFormFill.draftLoaded'));
        }
      } catch (error) {
        console.error('Error loading draft from local storage:', error);
      }
    }
  }, [formId, t]);

  const tryLoadForm = useCallback(
    async (codeValue) => {
      if (!formId) return;
      setPhase('loading');
      setError(null);
      try {
        const data = await publicGetForm(formId, {
          mode: 'fill',
          accessCode: codeValue || undefined,
        });

        if (data.accessRequired) {
          if (data.reason === 'access_code') {
            setPhase('code');
          } else if (data.reason === 'expired') {
            setPhase('error');
            setError({ type: 'expired', message: t('publicFormFill.linkExpired') });
          }
        } else {
          setForm(data);
          if (codeValue) setAccessCode(codeValue);
          setPhase('form');
        }
      } catch (e) {
        // Catch real errors, e.g., invalid code, form not found, public access disabled
        setPhase('error');
        setError({ type: 'other', message: e.message || t('publicFormFill.loadFailed') });
      }
    },
    [formId, t],
  );

  // Initial attempt without code
  useEffect(() => {
    if (!initialLoadTriedCode) {
      tryLoadForm(undefined);
      setInitialLoadTriedCode(true);
    }
  }, [tryLoadForm, initialLoadTriedCode]);

  const handleValidateCode = async () => {
    const codeVal = codeInput.trim();
    if (!codeVal) {
      setError({ type: 'invalid_code', message: t('publicFormFill.accessCodeRequired') });
      return;
    }
    // We expect `tryLoadForm` to throw an error for an invalid code
    setPhase('loading');
    setError(null);
    try {
      const data = await publicGetForm(formId, { mode: 'fill', accessCode: codeVal });
      if (data.accessRequired) {
        // This shouldn't happen if a code was provided, but handle defensively
        setPhase('code');
      } else {
        setForm(data);
        setAccessCode(codeVal);
        setPhase('form');
      }
    } catch (e) {
      setPhase('code');
      setError({ type: 'invalid_code', message: t('publicFormFill.accessCodeIncorrect') });
    }
  };

  const handleSaveDraft = useCallback(
    (values) => {
      try {
        localStorage.setItem(`draft_${formId}`, JSON.stringify(values));
        message.success(t('publicFormFill.draftSaved'));
      } catch (error) {
        console.error('Error saving draft to local storage:', error);
        message.error(t('publicFormFill.draftSaveFailed'));
      }
    },
    [formId, t],
  );

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const rec = await publicSubmitForm(formId, {
        data: values,
        accessCode: accessCode || undefined,
      });
      setSuccessRecord(rec);
      setPhase('submitted');
      localStorage.removeItem(`draft_${formId}`); // Remove draft after successful submission
    } catch (e) {
      setError({ type: 'other', message: e.message || t('publicFormFill.submissionFailed') });
      message.error(e.message || t('publicFormFill.submissionFailed'));
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewSubmission = () => {
    setSuccessRecord(null);
    setPhase('form');
  };

  // High aesthetic container root
  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 640 : false;
  const rootClass = `public-fill-root ${isMobile ? 'mobile' : ''}`;

  const renderLoading = () => (
    <div className="public-center-wrapper">
      <div className={`loading-shell ${isMobile ? 'loading-mobile' : ''}`}>
        <Spin size="large" />
        <div className="loading-text">{t('publicFormFill.loading')}</div>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="error-shell">
      <Result
        status={
          error?.type === 'expired' ? 'warning' : error?.type === 'not_found' ? '404' : 'error'
        }
        title={error?.message || t('publicFormFill.accessError')}
        subTitle={error?.type === 'disabled' ? t('publicFormFill.contactOwner') : null}
        extra={<Button onClick={() => tryLoadForm(accessCode || undefined)}>{t('publicFormFill.retry')}</Button>}
      />
    </div>
  );

  const renderCodeGate = () => (
    <div className="public-center-wrapper">
      <div className={`public-card ${isMobile ? 'public-card-mobile' : ''}`}>
        <Space orientation="vertical" size={22} style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            {t('publicFormFill.enterAccessCode')}
          </Title>
          <Text type="secondary">{t('publicFormFill.accessCodeDescription')}</Text>
          {error?.type === 'invalid_code' && (
            <Alert type="error" message={error.message} showIcon />
          )}
          <Input
            placeholder={t('publicFormFill.accessCodeExample')}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onPressEnter={handleValidateCode}
            maxLength={16}
            allowClear
          />
          <Button type="primary" block size="large" onClick={handleValidateCode}>
            {t('publicFormFill.verify')}
          </Button>
        </Space>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="public-center-wrapper">
      <div className={`success-card ${isMobile ? 'success-card-mobile' : ''}`}>
        <Result
          status="success"
          title={t('publicFormFill.submittedSuccess')}
          subTitle={successRecord?._id ? t('publicFormFill.recordId', { recordId: successRecord._id }) : t('publicFormFill.formSubmittedSuccessfully')}
          extra={
            <Button type="primary" size="large" onClick={handleNewSubmission}>
              {t('publicFormFill.continueFilling')}
            </Button>
          }
        />
      </div>
    </div>
  );

  const renderForm = () => (
    <DndProvider backend={HTML5Backend}>
      <header className="form-page-header">
        <div className="form-page-header-inner">
          {accessCode && <span className="verification-badge">{t('publicFormFill.verifiedWithCode')}</span>}
        </div>
      </header>
      <main className="form-body-container">
        <div className={`form-surface ${isMobile ? 'form-surface-mobile' : ''}`}>
          <FormRenderer
            form={form}
            onSubmit={handleSubmit}
            onSaveDraft={handleSaveDraft}
            align="center"
            hideActions={false}
            appId={form?.appId}
            initialValues={draftInitialValues}
          />
          {submitting && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Spin />
            </div>
          )}
        </div>
      </main>
    </DndProvider>
  );

  return (
    <div className={rootClass}>
      {phase === 'loading' && renderLoading()}
      {phase === 'error' && renderError()}
      {phase === 'code' && renderCodeGate()}
      {phase === 'submitted' && renderSuccess()}
      {phase === 'form' && renderForm()}
    </div>
  );
};

export default PublicFormFillPage;
