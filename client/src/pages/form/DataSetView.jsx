// DataManagementPage with per-cell inline editing (each field independently editable)
// Clean implementation replacing previously corrupted version.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dayjs from '../../utils/dayjs'; // Use centralized dayjs configuration
import FormRenderer from '../../components/FormRenderer';
import { useParams } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Typography,
  message,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Select,
  Checkbox,
  Tooltip,
  Popover,
  Modal,
} from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getForm } from '../../api/forms';
import {
  getFormData,
  updateFormData,
  deleteFormData,
  createDataRecord,
  exportFormDataExcel,
  exportFormTemplateExcel,
  importFormDataExcel,
} from '../../api/data';
import EditableCell from '../../features/data-management/EditableCell';
import { buildDynamicColumns } from '../../features/data-management/columnsBuilder.jsx';
import { useResizableColumns } from '../../features/data-management/ResizableHeader.jsx';
import ResizableDrawer from '../../components/common/ResizableDrawer';
import Permission from '../../components/Permission';
import { APP_PERMISSIONS } from '../../constants/permissions';

const DatasetView = () => {
  const { t } = useTranslation();
  const { appId, formId } = useParams();
  // Core state
  const [formSchema, setFormSchema] = useState(null);
  const [dataRecords, setDataRecords] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [editingCell, setEditingCell] = useState(null); // {recordId,fieldId}
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState([]); // { fieldId, operator, value }
  // Visible (i.e., not hidden) field ids. Persisted in localStorage so user layout is remembered.
  const [visibleFieldIds, setVisibleFieldIds] = useState(null); // null -> all; will initialize after schema load or from storage
  const [columnWidths, setColumnWidths] = useState({});
  const [frozenFieldIds, setFrozenFieldIds] = useState(() => {
    try {
      const k = `dmw_frozen_${appId}_${formId}`;
      const saved = localStorage.getItem(k);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [form] = Form.useForm();
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Filter builder state
  const [filterBuilderVisible, setFilterBuilderVisible] = useState(false);
  const [newFilterField, setNewFilterField] = useState();
  const [newFilterOperator, setNewFilterOperator] = useState('eq');
  const [newFilterValue, setNewFilterValue] = useState('');
  // Track in-flight saves to avoid duplicate update calls for same cell
  const saveInFlightRef = useRef({});

  // Helpers
  const isCellEditing = useCallback(
    (recordId, fieldId) =>
      editingCell && editingCell.recordId === recordId && editingCell.fieldId === fieldId,
    [editingCell],
  );

  const fieldDefs = useMemo(() => {
    if (!formSchema || !Array.isArray(formSchema.fields)) return [];
    return formSchema.fields.filter((f) => f && f.recordable !== false);
  }, [formSchema]);

  // Load form schema
  const fetchFormSchema = useCallback(async () => {
    if (formSchema?.id === formId) return;
    try {
      const res = await getForm(appId, formId);
      if (res) setFormSchema(res);
    } catch (e) {
      message.error(t('dataset.loadFormSchemaFailed'));
    }
  }, [appId, formId, formSchema?.id]);

  // Load data records
  const fetchDataRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        sortBy,
        order: sortOrder === 'ascend' ? 'asc' : 'desc',
        q: searchQuery || undefined,
        filters: filters.length ? JSON.stringify(filters) : undefined,
      };
      const res = await getFormData(formId, params);
      if (res?.records) {
        const processed = res.records.map((r) => ({
          ...r.data,
          id: r.id,
          createdAt: r.createdAt,
          docId: r.docId || null,
        }));
        setDataRecords(processed);
        setPagination((p) => ({ ...p, total: res.pagination.totalRecords }));
      }
    } catch {
      message.error(t('dataset.loadDataFailed'));
    } finally {
      setLoading(false);
    }
  }, [
    appId,
    formId,
    pagination.current,
    pagination.pageSize,
    sortBy,
    sortOrder,
    searchQuery,
    filters,
    t,
  ]);

  useEffect(() => {
    fetchFormSchema();
  }, [fetchFormSchema]);
  // Load saved column widths once form identifiers available
  useEffect(() => {
    if (!appId || !formId) return;
    try {
      const key = `dmw_widths_${appId}_${formId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const obj = JSON.parse(saved);
        if (obj && typeof obj === 'object') setColumnWidths(obj);
      }
    } catch {}
  }, [appId, formId]);

  // Initialize visibleFieldIds from localStorage (if saved) once schema available; otherwise default to all (excluding rich-text)
  useEffect(() => {
    if (!formSchema) return;
    if (visibleFieldIds === null) {
      try {
        const key = `dmw_visible_${appId}_${formId}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // Filter out fields that no longer exist
            const valid = parsed.filter(
              (id) => id === '__createdAt' || fieldDefs.some((f) => f.id === id),
            );
            setVisibleFieldIds(valid);
            return; // defer data fetch to next effect cycle with non-null visibleFieldIds
          }
        }
      } catch {
        /* ignore */
      }
      const defs = fieldDefs.filter((f) => f.type !== 'rich-text').map((f) => f.id);
      setVisibleFieldIds(defs);
      return;
    }
    // When visibleFieldIds already set -> fetch data
    fetchDataRecords();
  }, [formSchema, visibleFieldIds, fieldDefs, fetchDataRecords, appId, formId]);

  // Default-freeze first data column (if none frozen yet & nothing persisted)
  useEffect(() => {
    if (!formSchema || !visibleFieldIds) return;
    if (frozenFieldIds && frozenFieldIds.length > 0) return; // already have frozen config (from storage or user)
    // Determine first actual data field among visible (exclude createdAt pseudo field)
    const first = visibleFieldIds.find((id) => id !== '__createdAt');
    if (!first) return;
    setFrozenFieldIds([first]);
    try {
      localStorage.setItem(`dmw_frozen_${appId}_${formId}`, JSON.stringify([first]));
    } catch {}
  }, [formSchema, visibleFieldIds, frozenFieldIds, appId, formId]);

  // Persist visibleFieldIds whenever it changes (and is initialized)
  useEffect(() => {
    if (visibleFieldIds === null) return; // not initialized yet
    try {
      localStorage.setItem(`dmw_visible_${appId}_${formId}`, JSON.stringify(visibleFieldIds));
    } catch {
      /* ignore */
    }
  }, [visibleFieldIds, appId, formId]);

  const handleTableChange = (p, _f, sorter) => {
    setPagination(p);
    if (sorter.field) {
      setSortBy(sorter.field);
      setSortOrder(sorter.order);
    }
  };

  // Editing handlers
  const startEditCell = (record, field) => {
    if (!field || !record) return;
    let val = record[field.id];
    if (field.type === 'date-picker' && val) {
      const parsed = dayjs(val);
      if (parsed.isValid()) val = parsed;
    }
    if ((field.type === 'checkbox-group' || field.type === 'dropdown-checkbox') && val) {
      val = Array.isArray(val) ? val : [val];
    }
    form.setFieldsValue({ [field.id]: val });
    setEditingCell({ recordId: record.id, fieldId: field.id });
  };
  const cancelEditCell = () => setEditingCell(null);
  const saveEditCell = async (recordId, fieldId) => {
    const key = recordId + '::' + fieldId;
    if (saveInFlightRef.current[key]) return; // already saving
    saveInFlightRef.current[key] = true;
    try {
      const field = fieldDefs.find((f) => f.id === fieldId);
      if (!field) {
        cancelEditCell();
        return;
      }
      // Validate this single field first (ensures rules run)
      await form.validateFields([fieldId]);
      // Always fetch latest value directly from form to avoid potential stale snapshot inside validateFields
      let value = form.getFieldValue(fieldId);
      const originalRecord = dataRecords.find((r) => r.id === recordId);
      const originalValue = originalRecord ? originalRecord[fieldId] : undefined;

      if (field.type === 'date-picker' && value) {
        // Determine if original storage looked like a pure date (YYYY-MM-DD)
        const wasDateOnly =
          typeof originalValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(originalValue);
        // AntD (v5) DatePicker returns a dayjs object by default
        if (value?.isValid && value.isValid()) {
          value = wasDateOnly ? value.format('YYYY-MM-DD') : value.toDate().toISOString();
        } else if (value?.$d) {
          try {
            const d = new Date(value.$d);
            value = wasDateOnly ? dayjs(d).format('YYYY-MM-DD') : d.toISOString();
          } catch {
            /* ignore */
          }
        } else if (value instanceof Date) {
          value = wasDateOnly ? dayjs(value).format('YYYY-MM-DD') : value.toISOString();
        }
      }
      if ((field.type === 'checkbox-group' || field.type === 'dropdown-checkbox') && value) {
        const arr = Array.isArray(value) ? value : [value];
        value = Array.from(new Set(arr.filter((v) => v !== undefined && v !== null && v !== '')));
      }
      await updateFormData(recordId, { [fieldId]: value });
      setDataRecords((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, [fieldId]: value } : r)),
      );
      setEditingCell(null);
      message.success(t('dataset.saved'));
    } catch (e) {
      if (!e?.errorFields) message.error(t('dataset.saveFailed'));
    } finally {
      delete saveInFlightRef.current[key];
    }
  };

  // CRUD & bulk actions
  const handleDelete = async (id) => {
    try {
      await deleteFormData(id);
      message.success(t('dataset.deleteSuccess'));
      fetchDataRecords();
    } catch {
      message.error(t('dataset.deleteFailed'));
    }
  };

  const bulkDelete = async () => {
    if (!selectedRowKeys.length) return;
    try {
      await Promise.all(selectedRowKeys.map((id) => deleteFormData(id)));
      message.success(t('dataset.bulkDeleteSuccess', { count: selectedRowKeys.length }));
      setSelectedRowKeys([]);
      fetchDataRecords();
    } catch {
      message.error(t('dataset.bulkDeleteFailed'));
    }
  };

  const confirmBulkDelete = () => {
    if (!selectedRowKeys.length) return;
    const preview = selectedRowKeys.slice(0, 5).join(', ');
    Modal.confirm({
      title: t('dataset.confirmBulkDeleteTitle'),
      content: (
        <div>
          <p>{t('dataset.confirmBulkDeleteContent', { count: selectedRowKeys.length })}</p>
          <p style={{ fontSize: 12, color: '#999' }}>
            示例ID: {preview}
            {selectedRowKeys.length > 5 ? ' …' : ''}
          </p>
        </div>
      ),
      okText: t('dataset.delete'),
      okType: 'danger',
      cancelText: t('dataset.cancel'),
      onOk: bulkDelete,
    });
  };

  // Export/import
  const handleExportExcel = async () => {
    if (!formSchema) return;
    try {
      const params = {
        q: searchQuery || undefined,
        filters: filters.length ? JSON.stringify(filters) : undefined,
        selectedIds: selectedRowKeys.length ? JSON.stringify(selectedRowKeys) : undefined,
        sortBy,
        order: sortOrder === 'ascend' ? 'asc' : 'desc',
      };
      const blob = await exportFormDataExcel(formId, params);
      // Use the shared helper from utils
      const { saveBlobAsFile } = await import('../../utils/fileDownload');
      const filename = `${formSchema?.name || 'data'}-export-${dayjs().format('YYYYMMDDHHmmss')}.xlsx`;
      saveBlobAsFile(blob, filename);
      message.success(t('dataset.exportExcelSuccess'));
    } catch {
      message.error(t('dataset.exportExcelFailed'));
    }
  };
  const handleExportTemplate = async () => {
    if (!formSchema) return;
    try {
      const blob = await exportFormTemplateExcel(formId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formSchema?.name || 'data'}-template-${dayjs().format('YYYYMMDDHHmmss')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('dataset.exportTemplateSuccess'));
    } catch {
      message.error(t('dataset.exportTemplateFailed'));
    }
  };
  const importExcel = async (file) => {
    try {
      const res = await importFormDataExcel(formId, file);
      const inserted = res.inserted;
      const unmapped = res.unmappedRequired || [];
      message.success(t('dataset.importExcelSuccess', { inserted, unmapped: unmapped.join(', ') }));
      fetchDataRecords();
    } catch (error) {
      // The error from the interceptor is a standard Error object.
      // The backend might put structured info in the message.
      // Example: "第 5 行错误: 字段 '年龄' 为必填项"
      // We can try to display it nicely.
      const errorMessage = error.message || t('dataset.importExcelFailed');
      if (errorMessage.includes('行错误:')) {
        Modal.error({
          title: t('dataset.importFailedTitle'),
          content: errorMessage,
        });
      } else {
        message.error(errorMessage);
      }
    }
  };
  const triggerImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (/\.xlsx$/i.test(file.name)) importExcel(file);
      else message.error(t('dataset.unsupportedFile'));
    };
    input.click();
  };

  // Add record
  const handleAddRecord = async (values) => {
    const payload = fieldDefs.reduce((acc, f) => {
      let raw = values[f.id];
      if (raw === undefined) return acc;
      if (f.type === 'date-picker' && raw) {
        if (raw?.isValid && raw.isValid()) {
          // Default: store as date-only if no time part (hour/minute all zero and user likely picked date only)
          const hasTime = raw.hour?.() > 0 || raw.minute?.() > 0 || raw.second?.() > 0;
          raw = hasTime ? raw.toDate().toISOString() : raw.format('YYYY-MM-DD');
        } else if (raw instanceof Date) {
          raw = raw.toISOString();
        } else if (raw?.$d) {
          try {
            raw = new Date(raw.$d).toISOString();
          } catch {
            /* ignore */
          }
        }
      }
      acc[f.id] = raw;
      return acc;
    }, {});
    try {
      await createDataRecord(formId, payload);
      message.success(t('dataset.addRecordSuccess'));
      setIsAddModalVisible(false);
      form.resetFields();
      fetchDataRecords();
    } catch (e) {
      message.error(t('dataset.addRecordFailed'));
      throw e;
    }
  };

  const handleViewRecord = (record) => {
    // Clone and process record to ensure date strings are parsed for DatePicker
    const processed = { ...record };
    fieldDefs.forEach((f) => {
      if (f.type === 'date-picker' && processed[f.id]) {
        const d = dayjs(processed[f.id]);
        if (d.isValid()) processed[f.id] = d;
      }
    });
    setViewingRecord(processed);
    setIsEditMode(false);
    setIsViewModalVisible(true);
  };

  const handleEditRecord = async (values) => {
    if (!viewingRecord?.id) return;
    try {
      setSubmitting(true);
      // Only include actual data fields
      const payload = fieldDefs.reduce((acc, f) => {
        if (values[f.id] !== undefined) acc[f.id] = values[f.id];
        return acc;
      }, {});

      await updateFormData(viewingRecord.id, payload);
      message.success(t('dataset.updateSuccess'));
      setIsViewModalVisible(false);
      setIsEditMode(false);
      fetchDataRecords();
    } catch (e) {
      message.error(t('dataset.saveFailed'));
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  // Dynamic columns (extracted builder)
  const headerMenuHandlers = useMemo(
    () => ({
      onSortAsc: (field) => {
        setSortBy(field.id);
        setSortOrder('ascend');
        setPagination((p) => ({ ...p, current: 1 }));
      },
      onSortDesc: (field) => {
        setSortBy(field.id);
        setSortOrder('descend');
        setPagination((p) => ({ ...p, current: 1 }));
      },
      onFreeze: (field) => {
        setFrozenFieldIds((prev) => {
          const exists = prev.includes(field.id);
          const next = exists ? prev.filter((id) => id !== field.id) : [...prev, field.id];
          try {
            localStorage.setItem(`dmw_frozen_${appId}_${formId}`, JSON.stringify(next));
          } catch {}
          return next;
        });
      },
      onHide: (field) => {
        setVisibleFieldIds((ids) => {
          if (!ids) return ids;
          const next = ids.filter((id) => id !== field.id);
          try {
            localStorage.setItem(`dmw_visible_${appId}_${formId}`, JSON.stringify(next));
          } catch {}
          return next;
        });
      },
      onGroup: (field) => {
        message.info(t('dataset.groupByNotImplemented', { label: field.properties.label }));
      },
      onQuickFilterChange: (field, value) => {
        // Simple quick filter: replace existing filter for this field with new 'in' operator
        setFilters((prev) => {
          const others = prev.filter((f) => f.fieldId !== field.id);
          if (!value || (Array.isArray(value) && value.length === 0)) return others; // remove filter
          const val = Array.isArray(value) ? value : [value];
          return [...others, { fieldId: field.id, operator: 'in', value: val }];
        });
        setPagination((p) => ({ ...p, current: 1 }));
      },
    }),
    [t, appId, formId],
  );

  const dynamicColumns = useMemo(
    () =>
      buildDynamicColumns(
        fieldDefs,
        visibleFieldIds,
        columnWidths,
        headerMenuHandlers,
        frozenFieldIds,
      ),
    [fieldDefs, visibleFieldIds, columnWidths, headerMenuHandlers, frozenFieldIds],
  );

  // Static columns (operations)
  const staticColumns = useMemo(
    () => [
      {
        title: t('dataset.operation'),
        dataIndex: 'operation',
        key: 'operation',
        fixed: 'right',
        width: 160,
        render: (_, record) => (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewRecord(record)}
            >
              {t('dataset.view')}
            </Button>
            <Permission require={APP_PERMISSIONS.FORM_DESIGN} scope="app">
              <Popconfirm
                title={t('dataset.confirmDelete')}
                onConfirm={() => handleDelete(record.id)}
                okText={t('dataset.yes')}
                cancelText={t('dataset.no')}
              >
                <Button type="link" danger size="small">
                  <DeleteOutlined /> {t('dataset.delete')}
                </Button>
              </Popconfirm>
            </Permission>
          </Space>
        ),
      },
    ],
    [handleDelete, t],
  );

  // Combine columns
  const columnsBase = useMemo(() => {
    const cols = [...dynamicColumns];
    if (!visibleFieldIds || visibleFieldIds.includes('__createdAt'))
      cols.push({
        title: t('dataset.createdAt'),
        dataIndex: 'createdAt',
        key: 'createdAt',
        sorter: true,
        width: columnWidths['createdAt'] || 180,
        render: (text) => (dayjs(text).isValid() ? dayjs(text).format('YYYY-MM-DD HH:mm') : text),
      });
    return [...cols, ...staticColumns];
  }, [dynamicColumns, staticColumns, visibleFieldIds, columnWidths, t]);

  // Inject per-cell editing handlers
  const columns = useMemo(
    () =>
      columnsBase.map((col) => {
        if (!col.editable) return col;
        const fieldDef = fieldDefs.find((f) => f.id === col.dataIndex);
        return {
          ...col,
          onCell: (record) => ({
            record,
            fieldDef,
            dataIndex: col.dataIndex,
            editing: isCellEditing(record.id, col.dataIndex),
            startEditCell,
            saveEditCell,
            cancelEditCell,
          }),
          render: (value, record) =>
            !isCellEditing(record.id, col.dataIndex)
              ? col.render
                ? col.render(value, record)
                : value
              : null,
        };
      }),
    [columnsBase, fieldDefs, isCellEditing],
  );

  // Use external resizable header hook
  const { mergedColumns, HeaderCell } = useResizableColumns({
    appId,
    formId,
    columns,
    columnWidths,
    setColumnWidths,
  });

  // Field visibility options
  const columnOptions = [
    ...fieldDefs.map((f) => ({ label: f.properties.label, value: f.id })),
    { label: t('dataset.createdAt'), value: '__createdAt' },
  ];

  // Filter builder actions
  const handleAddFilter = () => {
    if (!newFilterField || newFilterValue === '') {
      message.warning(t('dataset.selectFieldAndValue'));
      return;
    }
    setFilters((prev) => [
      ...prev,
      { fieldId: newFilterField, operator: newFilterOperator, value: newFilterValue },
    ]);
    setPagination((p) => ({ ...p, current: 1 }));
    setNewFilterField(undefined);
    setNewFilterValue('');
    setNewFilterOperator('eq');
    setFilterBuilderVisible(false);
  };
  const handleFilterRefresh = () => fetchDataRecords();

  //   const columns1 = [
  //   {
  //     title: 'Full Name',
  //     width: 100,
  //     dataIndex: 'name',
  //     key: 'name',
  //     fixed: 'left',
  //   },
  //   {
  //     title: 'Age',
  //     width: 100,
  //     dataIndex: 'age',
  //     key: 'age',
  //     fixed: 'left',
  //     sorter: true,
  //   },
  //   { title: 'Column 1', dataIndex: 'address', key: '1' },
  //   { title: 'Column 2', dataIndex: 'address', key: '2' },
  //   { title: 'Column 3', dataIndex: 'address', key: '3' },
  //   { title: 'Column 4', dataIndex: 'address', key: '4' },
  //   { title: 'Column 5', dataIndex: 'address', key: '5' },
  //   { title: 'Column 6', dataIndex: 'address', key: '6' },
  //   { title: 'Column 7', dataIndex: 'address', key: '7' },
  //   { title: 'Column 8', dataIndex: 'address', key: '8' },
  //   { title: 'Column 9', dataIndex: 'address', key: '9' },
  //   { title: 'Column 10', dataIndex: 'address', key: '10' },
  //   { title: 'Column 11', dataIndex: 'address', key: '11' },
  //   { title: 'Column 12', dataIndex: 'address', key: '12' },
  //   { title: 'Column 13', dataIndex: 'address', key: '13' },
  //   { title: 'Column 14', dataIndex: 'address', key: '14' },
  //   { title: 'Column 15', dataIndex: 'address', key: '15' },
  //   { title: 'Column 16', dataIndex: 'address', key: '16' },
  //   { title: 'Column 17', dataIndex: 'address', key: '17' },
  //   { title: 'Column 18', dataIndex: 'address', key: '18' },
  //   { title: 'Column 19', dataIndex: 'address', key: '19' },
  //   { title: 'Column 20', dataIndex: 'address', key: '20' },
  //   {
  //     title: 'Action',
  //     key: 'operation',
  //     fixed: 'right',
  //     width: 100,
  //     render: () => <a>action</a>,
  //   },
  // ];

  return (
    <div
      style={{
        padding: 12,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '0',
        flexGrow: 1,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div>
          <Space align="center">
            <Permission require={APP_PERMISSIONS.FORM_DESIGN} scope="app">
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setIsAddModalVisible(true)}
              >
                {t('dataset.add')}
              </Button>
            </Permission>
            <Permission require={APP_PERMISSIONS.FORM_DESIGN} scope="app">
              <Tooltip title={t('dataset.import')}>
                <Button size="small" icon={<UploadOutlined />} onClick={triggerImport}>
                  {t('dataset.import')}
                </Button>
              </Tooltip>
            </Permission>
            <Permission
              require={APP_PERMISSIONS.FORM_EXPORT || APP_PERMISSIONS.FORM_VIEW}
              scope="app"
            >
              <Tooltip title={t('dataset.exportDataExcel')}>
                <Button size="small" icon={<DownloadOutlined />} onClick={handleExportExcel}>
                  {t('dataset.export')}
                </Button>
              </Tooltip>
            </Permission>
            <Tooltip title={t('dataset.downloadTemplate')}>
              <Button size="small" onClick={handleExportTemplate}>
                {t('dataset.template')}
              </Button>
            </Tooltip>
            <Permission require={APP_PERMISSIONS.FORM_DESIGN} scope="app">
              <Tooltip title={t('dataset.delete')}>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!selectedRowKeys.length}
                  onClick={confirmBulkDelete}
                >
                  {t('dataset.delete')}
                </Button>
              </Tooltip>
            </Permission>
            <Popover
              title={t('dataset.showFields')}
              trigger="click"
              content={
                <div style={{ maxWidth: 320 }}>
                  <Checkbox.Group
                    options={columnOptions}
                    value={visibleFieldIds}
                    onChange={(vals) => setVisibleFieldIds(vals)}
                  />
                </div>
              }
            >
              <Button size="small" icon={<EyeOutlined />}>
                {t('dataset.showFields')}
              </Button>
            </Popover>
          </Space>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input.Search
            size="small"
            placeholder={t('dataset.searchData')}
            allowClear
            onSearch={(val) => {
              setSearchQuery(val);
              setPagination((p) => ({ ...p, current: 1 }));
            }}
            onChange={(e) => {
              if (!e.target.value) {
                setSearchQuery('');
                setPagination((p) => ({ ...p, current: 1 }));
              }
            }}
            style={{ width: 200 }}
          />
          <Popover
            open={filterBuilderVisible}
            onOpenChange={(v) => setFilterBuilderVisible(v)}
            trigger="click"
            content={
              <div style={{ width: 260 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Select
                    placeholder={t('dataset.field')}
                    size="small"
                    value={newFilterField}
                    onChange={setNewFilterField}
                    options={columnOptions}
                    style={{ width: '100%' }}
                  />
                  <Select
                    size="small"
                    value={newFilterOperator}
                    onChange={setNewFilterOperator}
                    options={[
                      { label: t('dataset.operatorEquals'), value: 'eq' },
                      { label: t('dataset.operatorNotEquals'), value: 'ne' },
                      { label: t('dataset.operatorContains'), value: 'regex' },
                      { label: t('dataset.operatorIn'), value: 'in' },
                    ]}
                    style={{ width: '100%' }}
                  />
                  <Input
                    size="small"
                    placeholder={t('dataset.value')}
                    value={newFilterValue}
                    onChange={(e) => setNewFilterValue(e.target.value)}
                  />
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Button size="small" type="primary" onClick={handleAddFilter}>
                      {t('dataset.add')}
                    </Button>
                    <Button size="small" onClick={handleFilterRefresh}>
                      {t('dataset.apply')}
                    </Button>
                  </Space>
                </Space>
              </div>
            }
          >
            <Button size="small">{t('dataset.advancedSearch')}</Button>
          </Popover>
          <Button size="small" onClick={handleFilterRefresh}>
            {t('dataset.refresh')}
          </Button>
        </div>
      </div>

      {/* Active filters display */}
      <div style={{ marginBottom: 8 }}>
        <Space wrap>
          {filters.map((flt, idx) => (
            <Space key={idx} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Typography.Text>
                {fieldDefs.find((f) => f.id === flt.fieldId)?.properties.label || flt.fieldId}
              </Typography.Text>
              <Input
                size="small"
                value={flt.value}
                onChange={(e) =>
                  setFilters((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, value: e.target.value } : p)),
                  )
                }
                style={{ width: 140 }}
              />
              <Button
                size="small"
                onClick={() => setFilters((prev) => prev.filter((_, i) => i !== idx))}
              >
                {t('dataset.remove')}
              </Button>
            </Space>
          ))}
          {filters.length > 0 && (
            <Button
              size="small"
              onClick={() => {
                setFilters([]);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
            >
              {t('dataset.clearAdvancedSearch')}
            </Button>
          )}
        </Space>
      </div>

      {/* Data table */}
      <Form
        form={form}
        component={false}
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {formSchema && (
          <Table
            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
            size="small"
            bordered
            sticky
            scroll={{ x: 'max-content', y: 'auto' }}
            dataSource={dataRecords}
            columns={mergedColumns}
            rowClassName="editable-row"
            pagination={{
              ...pagination,
              showSizeChanger: true,
              pageSizeOptions: ['10', '15', '20', '50'],
            }}
            loading={loading}
            onChange={handleTableChange}
            rowKey="id"
            components={{ header: { cell: HeaderCell }, body: { cell: EditableCell } }}
            style={{ flexGrow: 1, minHeight: 0 }}
          />
        )}
        {/* {
          !formSchema && console.log('Rendering DataManagementPage', mergedColumns)
        } */}
      </Form>

      {/* Add record drawer using form schema */}
      <ResizableDrawer
        title={t('dataset.addRecordTitle')}
        open={isAddModalVisible}
        placement="bottom"
        defaultHeight={600}
        onClose={() => setIsAddModalVisible(false)}
        destroyOnClose
        styles={{ body: { paddingBottom: 24 } }}
      >
        {formSchema && (
          <FormRenderer
            form={{ ...formSchema, actions: [{ type: 'submit', label: t('dataset.save') }] }}
            onSubmit={handleAddRecord}
            align="left"
            initialValues={{}}
            appId={appId}
          />
        )}
      </ResizableDrawer>

      {/* View record drawer */}
      <ResizableDrawer
        title={isEditMode ? t('dataset.edit') : t('dataset.viewRecordTitle')}
        open={isViewModalVisible}
        placement="right"
        defaultWidth={800}
        onClose={() => {
          setIsViewModalVisible(false);
          setViewingRecord(null);
          setIsEditMode(false);
        }}
        destroyOnClose
        extra={
          !isEditMode && (
            <Button type="primary" size="small" ghost onClick={() => setIsEditMode(true)}>
              {t('dataset.edit')}
            </Button>
          )
        }
      >
        {viewingRecord && formSchema && (
          <FormRenderer
            form={
              isEditMode
                ? { ...formSchema, actions: [{ type: 'submit', label: t('dataset.save') }] }
                : formSchema
            }
            initialValues={viewingRecord}
            readOnly={!isEditMode}
            onSubmit={isEditMode ? handleEditRecord : undefined}
            appId={appId}
            showTitle={false}
          />
        )}
      </ResizableDrawer>
    </div>
  );
};

export default DatasetView;
