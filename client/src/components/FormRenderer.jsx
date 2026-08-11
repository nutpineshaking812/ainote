import React, { useEffect, useState } from 'react';
import { Form, Button, message, Space, Row, Col, Typography, Divider } from 'antd';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import XMarkdown from '@ant-design/x-markdown';
import { groupFieldsIntoRows } from '../features/form-builder/layoutUtils';
import { componentRegistry } from '../features/form-builder/registry';
import RequiredLabel from '../components/RequiredLabel';

const { Title } = Typography;

const FormRenderer = ({
  form,
  onSubmit,
  onSaveDraft,
  align = 'center',
  initialValues = {},
  hideActions = false,
  appId: appIdOverride,
  overrides = {}, // { fieldId: { hidden, readOnly } }
  showTitle = true,
  showDescription = true,
  readOnly = false,
  loading: externalLoading = false,
}) => {
  const [antForm] = Form.useForm();

  // Sync initialValues when they change (e.g. record switched in preview)
  useEffect(() => {
    // Only update existing fields to avoid wiping uncontrolled future additions
    if (initialValues && Object.keys(initialValues).length) {
      antForm.setFieldsValue(initialValues);
    } else {
      antForm.resetFields();
    }
  }, [initialValues, antForm]);

  if (!form) {
    return null;
  }

  const [submitting, setSubmitting] = useState(false);

  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 640 : false;

  const onFinish = async (values) => {
    try {
      setSubmitting(true);
      await Promise.resolve(onSubmit(values));
      antForm.resetFields();
    } catch (error) {
      console.error('Form submission failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const onFinishFailed = (errorInfo) => {
    message.error('提交表单失败');
  };

  const renderButtons = () => {
    const defaultActions = [
      { type: 'submit', label: '提交' },
      { type: 'save_draft', label: '保存草稿' },
    ];

    const actions = form.actions || defaultActions;

    const buttonNodes = actions.map((action) => {
      const isSubmit = action.type === 'submit';
      const btnType = isSubmit ? 'primary' : 'default';
      const isLoading = (isSubmit && submitting) || externalLoading;
      const ariaLabel = isSubmit ? '提交表单' : action.label;
      return (
        <Button
          key={action.type}
          type={btnType}
          htmlType={isSubmit ? 'submit' : undefined}
          loading={isLoading}
          disabled={isLoading}
          aria-label={ariaLabel}
          style={isMobile ? { width: '100%' } : undefined}
          onClick={
            action.type === 'save_draft'
              ? () => {
                  if (onSaveDraft) {
                    onSaveDraft(antForm.getFieldsValue());
                  }
                }
              : undefined
          }
        >
          {action.label}
        </Button>
      );
    });

    if (isMobile) {
      return (
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          {buttonNodes}
        </Space>
      );
    }
    if (hideActions || readOnly) return null;
    return <Space size={16}>{buttonNodes}</Space>;
  };

  // Page container with a max width to keep forms readable on large screens
  const pageStyle = {
    maxWidth: 1100,
    margin: align === 'center' ? '0 auto' : '0',
    padding: '16px',
  };

  const resolvedAppId = appIdOverride || form?.appId || form?.applicationId;
  const resolvedFormId = form?._id || form?.id;

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={pageStyle}>
        {showTitle && (
          <Title level={2} style={{ textAlign: 'center', marginBottom: '24px' }}>
            {form.name}
          </Title>
        )}
        {showDescription && form.description && (
          <div style={{ marginBottom: '24px' }}>
            <XMarkdown config={{ breaks: true }}>{form.description}</XMarkdown>
          </div>
        )}
        {(showTitle || (showDescription && form.description)) && <Divider />}
        <Form
          form={antForm}
          layout="vertical"
          initialValues={initialValues}
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
        >
          {(() => {
            const rows = groupFieldsIntoRows(form.fields || []);
            const visibleFields = (form.fields || []).filter((f) => {
              if (f.type === 'placeholder') return false;
              const fieldOverride = overrides[f.id] || {};
              const mergedProperties = { ...f.properties, ...fieldOverride };
              return !mergedProperties.hidden;
            });
            return rows.map((row, rowIndex) => (
              <Row key={`row-${rowIndex}`} gutter={[16, 16]} style={{ marginBottom: 0 }}>
                {row.map((field) => {
                  if (!field) return null;

                  // Apply overrides if any
                  const fieldOverride = overrides[field.id] || {};
                  const mergedProperties = { ...field.properties, ...fieldOverride };

                  const isHidden = !!mergedProperties.hidden;

                  // placeholder nodes (if any) can be rendered as empty Col
                  if (field.type === 'placeholder') {
                    const span = field.layout?.span || 24;
                    return <Col key={field.id || Math.random()} span={span} />;
                  }
                  const fieldIndex = visibleFields.findIndex((f) => f.id === field.id) + 1;
                  const plugin = componentRegistry.get(field.type);
                  const Component = plugin?.rendererComponent;
                  if (!Component) {
                    return (
                      <Col key={field.id} span={field.layout?.span || 24}>
                        Unsupported field type: {field.type}
                      </Col>
                    );
                  }
                  let span = field.layout?.span || 24;
                  if (isMobile) {
                    span = 24;
                  }
                  const isFullRow = span === 24;
                  const isLayoutOnly = field.recordable === false;
                  const maxWidthStyle = { maxWidth: 900, margin: '0' };

                  // Recalculate merged properties here for the rest of the block

                  if (isLayoutOnly) {
                    return (
                      <Col key={field.id} span={span}>
                        {isFullRow ? (
                          <div style={maxWidthStyle}>
                            <Component
                              field={{ ...field, properties: mergedProperties }}
                              showIndex={form.showIndex}
                              fieldIndex={fieldIndex}
                            />
                          </div>
                        ) : (
                          <Component
                            field={{ ...field, properties: mergedProperties }}
                            showIndex={form.showIndex}
                            fieldIndex={fieldIndex}
                          />
                        )}
                      </Col>
                    );
                  }

                  const rawLabel = mergedProperties.label || (plugin ? plugin.label : '字段');
                  const displayLabel =
                    form.showIndex && fieldIndex ? `${fieldIndex}. ${rawLabel}` : rawLabel;
                  const isRequired = !!field.validation?.required;
                  const labelNode = <RequiredLabel text={displayLabel} required={isRequired} />;
                  const builtRules = Array.isArray(field.rules) ? [...field.rules] : [];
                  const validation = field.validation || {};
                  if (isRequired) {
                    const hasRequired = builtRules.some(
                      (r) => r && (r.required === true || r.validator),
                    );
                    if (!hasRequired) {
                      builtRules.unshift({ required: true, message: `${rawLabel} 为必填项` });
                    }
                  }
                  const patternString =
                    typeof validation.pattern === 'string' ? validation.pattern : undefined;
                  if (patternString) {
                    try {
                      const regex = new RegExp(patternString);
                      const hasPatternRule = builtRules.some(
                        (rule) =>
                          rule &&
                          rule.pattern instanceof RegExp &&
                          rule.pattern.toString() === regex.toString(),
                      );
                      if (!hasPatternRule) {
                        builtRules.push({ pattern: regex, message: `${rawLabel} 格式不正确` });
                      }
                    } catch (err) {
                      console.warn(`Invalid pattern for field ${field.id}:`, err.message);
                    }
                  }
                  return (
                    <Col
                      key={field.id}
                      span={isHidden ? 0 : span}
                      style={isHidden ? { display: 'none' } : {}}
                    >
                      {isFullRow && !isHidden ? (
                        <div style={maxWidthStyle}>
                          <Form.Item
                            label={labelNode}
                            name={field.id}
                            rules={builtRules}
                            required={false}
                            hidden={isHidden}
                          >
                            <Component
                              field={{ ...field, properties: mergedProperties }}
                              appId={resolvedAppId}
                              formId={resolvedFormId}
                              showIndex={form.showIndex}
                              fieldIndex={fieldIndex}
                              disabled={readOnly || mergedProperties.readOnly}
                            />
                          </Form.Item>
                        </div>
                      ) : (
                        <Form.Item
                          label={labelNode}
                          name={field.id}
                          rules={builtRules}
                          required={false}
                          hidden={isHidden}
                        >
                          <Component
                            field={{ ...field, properties: mergedProperties }}
                            appId={resolvedAppId}
                            formId={resolvedFormId}
                            showIndex={form.showIndex}
                            fieldIndex={fieldIndex}
                            disabled={readOnly || mergedProperties.readOnly}
                          />
                        </Form.Item>
                      )}
                    </Col>
                  );
                })}
              </Row>
            ));
          })()}
          {!hideActions && (
            <Form.Item style={isMobile ? { marginTop: 8 } : { marginTop: 16 }}>
              {renderButtons()}
            </Form.Item>
          )}
        </Form>
      </div>
    </DndProvider>
  );
};

export default FormRenderer;
