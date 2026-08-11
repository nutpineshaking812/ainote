import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Layout } from 'antd';
import { useTranslation } from 'react-i18next';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ComponentPalette from '../../features/form-builder/ComponentPalette';
import FormCanvas from '../../features/form-builder/FormCanvas';
import PropertiesEditor from '../../features/form-builder/PropertiesEditor';
import FormBuilderContext from '../../contexts/FormBuilderContext';
import { componentRegistry } from '../../features/form-builder/registry';
// import { v4 as uuidv4 } from 'uuid'; // No longer needed for field IDs
import { generateShortId } from '../../utils/shortId';
import { useParams } from 'react-router-dom';

const { Sider, Content } = Layout;

const BuilderView = () => {
  const { t } = useTranslation();
  const builderContext = useContext(FormBuilderContext) || {};
  const { setHeaderTitle, setHeaderTitleChangeHandler, formData, setFormData, formLoading } =
    builderContext;
  const { appId, formId } = useParams();
  const [selectedFieldId, setSelectedFieldId] = useState(null);

  const form = formData || null;
  const fields = Array.isArray(form?.fields) ? form.fields : [];

  useEffect(() => {
    setSelectedFieldId(null);
  }, [appId, formId]);

  useEffect(() => {
    if (!setHeaderTitle) return;
    if (form && (form._id === formId || form.id === formId)) {
      setHeaderTitle(form.name);
    } else if (formId === 'new') {
      setHeaderTitle(t('formBuilder.newForm'));
    }
  }, [form, formId, setHeaderTitle, t]);

  const updateFormValue = useCallback(
    (updater) => {
      if (!setFormData) return;
      setFormData((prev) => {
        if (!prev) return prev;
        const next = typeof updater === 'function' ? updater(prev) : updater;
        return next ?? prev;
      });
    },
    [setFormData],
  );

  const updateFields = useCallback(
    (producer) => {
      if (!setFormData) return;
      setFormData((prev) => {
        if (!prev) return prev;
        const prevFields = Array.isArray(prev.fields) ? prev.fields : [];
        const nextFields = producer(prevFields);
        if (!nextFields) return prev;
        return { ...prev, fields: nextFields };
      });
    },
    [setFormData],
  );

  useEffect(() => {
    if (!setHeaderTitleChangeHandler) return;
    const handler = (nextName) => {
      updateFormValue((prev) => {
        if (!prev) return prev;
        if (prev.name === nextName) return prev;
        return { ...prev, name: nextName };
      });
    };
    setHeaderTitleChangeHandler(() => handler);
    return () => {
      setHeaderTitleChangeHandler(() => null);
    };
  }, [setHeaderTitleChangeHandler, updateFormValue]);

  // drag state now handled internally by FormCanvas

  const handleDrop = useCallback(
    (type, index) => {
      const plugin = componentRegistry.get(type);
      if (!plugin) return;
      const existingIds = new Set(fields.map((f) => f.id));
      const id = generateShortId(existingIds);
      updateFields((prev) => {
        const next = [...prev];
        next.splice(index, 0, {
          id,
          type: plugin.type,
          recordable: plugin.recordable === false ? false : true,
          properties: plugin.defaultValue(),
          layout: { span: 24 },
          validation: { required: false, min: undefined, max: undefined, pattern: undefined },
        });
        return next;
      });
    },
    [updateFields],
  );

  const handleUpdateField = useCallback(
    (fieldId, newProps, propType = 'properties') => {
      updateFields((prev) =>
        prev.map((f) => {
          if (f.id !== fieldId) return f;
          if (propType === 'validation') {
            const safeProps = newProps && typeof newProps === 'object' ? newProps : {};
            return { ...f, validation: { ...safeProps } };
          }
          const currentBag = f[propType] && typeof f[propType] === 'object' ? f[propType] : {};
          return { ...f, [propType]: { ...currentBag, ...newProps } };
        }),
      );
    },
    [updateFields],
  );

  const handleDeleteField = useCallback(
    (fieldId) => {
      updateFields((prev) => prev.filter((f) => f.id !== fieldId));
      setSelectedFieldId((id) => (id === fieldId ? null : id));
    },
    [updateFields],
  );

  const handleCopyField = useCallback(
    (fieldId) => {
      updateFields((prev) => {
        const idx = prev.findIndex((f) => f.id === fieldId);
        if (idx === -1) return prev;
        const existingIds = new Set(prev.map((f) => f.id));
        const copy = JSON.parse(JSON.stringify(prev[idx]));
        copy.id = generateShortId(existingIds);
        // Normalize validation object including new props
        const v = copy.validation || {};
        copy.validation = {
          required: v.required === true,
          min: typeof v.min === 'number' ? v.min : undefined,
          max: typeof v.max === 'number' ? v.max : undefined,
          pattern: typeof v.pattern === 'string' ? v.pattern : undefined,
        };
        const next = [...prev];
        next.splice(idx + 1, 0, copy);
        return next;
      });
    },
    [updateFields],
  );

  // save moved to page

  const isCurrentForm = form && (formId === 'new' || form._id === formId || form.id === formId);

  if (formLoading) {
    return <div style={{ padding: 48 }}>{t('formBuilder.loading')}</div>;
  }

  if (!isCurrentForm) {
    return <div style={{ padding: 48 }}>{t('formBuilder.formNotFound')}</div>;
  }

  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <Layout style={{ height: '100%' }}>
          <Sider
            width={280}
            theme="light"
            style={{ background: '#fafafa', borderRight: '1px solid #f0f0f0' }}
          >
            <ComponentPalette handleDrop={handleDrop} fields={fields} />
          </Sider>

          <Content style={{ flex: 1 }}>
            <FormCanvas
              fields={fields}
              updateFields={updateFields}
              form={form}
              onDrop={handleDrop}
              onSelectField={setSelectedFieldId}
              selectedFieldId={selectedFieldId}
              onDelete={handleDeleteField}
              onCopy={handleCopyField}
            />
          </Content>

          <Sider
            width={320}
            theme="light"
            style={{ background: '#fff', borderLeft: '1px solid #f0f0f0' }}
          >
            <PropertiesEditor
              selectedField={fields.find((f) => f.id === selectedFieldId)}
              updateField={handleUpdateField}
              form={form}
              setForm={updateFormValue}
              appId={appId}
            />
          </Sider>
        </Layout>
      </DndProvider>
    </>
  );
};

export default BuilderView;
