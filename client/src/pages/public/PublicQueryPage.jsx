import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Space, Input, Alert, Spin, Result, Table, Empty, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { publicGetForm, publicQueryRecords } from '../../api/publish';

const { Title, Text } = Typography;
const { Search } = Input;

// Phases: loading | code | data | error
const PublicQueryPage = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { formId } = useParams();
  const [phase, setPhase] = useState('loading');
  const [form, setForm] = useState(null);
  const [accessCode, setAccessCode] = useState(''); // verified code only
  const [codeInput, setCodeInput] = useState(''); // raw input before verification
  const [error, setError] = useState(null); // { type, message }
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [initialLoadTriedCode, setInitialLoadTriedCode] = useState(false);

  const tryLoadForm = useCallback(async (codeValue) => {
    if (!formId) return;
    setPhase('loading');
    setError(null);
    try {
      const data = await publicGetForm(formId, { mode: 'query', accessCode: codeValue || undefined });
      if (data.accessRequired) {
        if (data.reason === 'access_code') {
          setPhase('code');
        } else if (data.reason === 'expired') {
          setPhase('error');
          setError({ type: 'expired', message: t('publicQuery.linkExpired') });
        }
      } else {
        setForm(data);
        setAccessCode(codeValue);
        setPhase('form'); // Changed to 'form' to be consistent with PublicFormFillPage
      }
    } catch (e) {
      setPhase('code');
      setError({ type: 'invalid_code', message: t('publicQuery.accessCodeIncorrect') });
    }
  }, [formId, t]);

  // Load records with pagination and search
  const loadRecords = useCallback(async (page = 1, keyword = searchKeyword, codeValue = accessCode) => {
    if (!formId) return;
    setLoadingData(true);
    try {
      const result = await publicQueryRecords(formId, {
        page,
        limit: pagination.pageSize,
        q: keyword || undefined,
        accessCode: codeValue || undefined,
      });
      setRecords(result.records || []);
      setPagination(prev => ({
        ...prev,
        current: result.pagination?.currentPage || page,
        total: result.pagination?.totalRecords || 0,
      }));
    } catch (e) {
      setError({ type: 'other', message: e.message || t('publicQuery.loadRecordsFailed') });
    } finally {
      setLoadingData(false);
    }
  }, [formId, pagination.pageSize, searchKeyword, accessCode, t]);

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
      setError({ type: 'invalid_code', message: t('publicQuery.accessCodeRequired') });
      return;
    }
    setPhase('loading');
    setError(null);
    try {
      const data = await publicGetForm(formId, { mode: 'query', accessCode: codeVal });
      if (data.accessRequired) {
        setPhase('code');
      } else {
        setForm(data);
        setAccessCode(codeVal);
        setPhase('data');
        loadRecords(1, '', codeVal);
      }
    } catch (e) {
      setPhase('code');
      setError({ type: 'invalid_code', message: t('publicQuery.accessCodeIncorrect') });
    }
  };

  const handleSearch = (value) => {
    const keyword = value.trim();
    setSearchKeyword(keyword);
    loadRecords(1, keyword);
  };

  const handleTableChange = (pag) => {
    loadRecords(pag.current);
  };

  // Generate table columns from form fields (backend already filtered by permissions)
  const generateColumns = () => {
    if (!form?.fields) return [];
    
    return form.fields.map(field => ({
      title: field.properties?.label || field.id,
      dataIndex: ['data', field.id],
      key: field.id,
      ellipsis: true,
      render: (value) => {
        if (value === null || value === undefined) return t('publicQuery.noValue');
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      },
    }));
  };

  // Render branches
  if (phase === 'loading') {
    return <div style={{ padding: '40px', textAlign: 'center' }}><Spin size="large" /><div style={{ marginTop: 16 }}>{t('publicQuery.loading')}</div></div>;
  }

  if (phase === 'error') {
    return (
      <Result
        status={error?.type === 'expired' ? 'warning' : (error?.type === 'not_found' ? '404' : 'error')}
        title={error?.message || t('publicQuery.accessError')}
        subTitle={error?.type === 'disabled' ? t('publicQuery.contactOwner') : null}
        extra={<Button onClick={() => tryLoadForm(accessCode || undefined)}>{t('publicQuery.retry')}</Button>}
      />
    );
  }

  if (phase === 'code') {
    return (
      <div style={{ maxWidth: 420, margin: '60px auto', padding: 32, border: '1px solid #f0f0f0', borderRadius: 8 }}>
        <Space orientation="vertical" size={20} style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>{t('publicQuery.enterAccessCode')}</Title>
          <Text type="secondary">{t('publicQuery.accessCodeDescription')}</Text>
          {error?.type === 'invalid_code' && <Alert type="error" message={error.message} showIcon />}
          <Input
            placeholder={t('publicQuery.accessCodeExample')}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onPressEnter={handleValidateCode}
            maxLength={16}
          />
          <Button type="primary" block onClick={handleValidateCode}>{t('publicQuery.verify')}</Button>
        </Space>
      </div>
    );
  }

  // Data phase
  const columns = generateColumns();

  return (
    <div style={{ maxWidth: 1200, margin: '20px auto', padding: '0 16px' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>{form?.name || t('publicQuery.dataQuery')}</Title>
          {accessCode && <Text type="secondary">{t('publicQuery.verifiedWithCode')}</Text>}
        </div>

        <Search
          placeholder={t('publicQuery.searchKeywordPlaceholder')}
          enterButton={<><SearchOutlined /> {t('publicQuery.search')}</>}
          size="large"
          onSearch={handleSearch}
          loading={loadingData}
          style={{ maxWidth: 600 }}
        />

        <Table
          columns={columns}
          dataSource={records}
          rowKey="_id"
          loading={loadingData}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (total) => t('publicQuery.totalRecords', { total }),
            showSizeChanger: false,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: <Empty description={t('publicQuery.noData')} />,
          }}
          scroll={{ x: 'max-content' }}
        />
      </Space>
    </div>
  );
};

export default PublicQueryPage;
