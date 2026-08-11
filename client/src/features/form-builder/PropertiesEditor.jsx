import React from 'react';
import { Form, Input, Divider, Row, Col, Checkbox, Tabs, Typography } from 'antd';
import { componentRegistry } from './registry';
import LayoutProperties from './LayoutProperties';
import SectionHeader from './SectionHeader.jsx';

const { Title, Text } = Typography;

const FormProperties = ({ form, setForm }) => {
  if (!form) return null;
  const handleActionChange = (actionType, key, value) => {
    setForm((prev) => {
      let newActions = [...(prev.actions || [])];
      const actionIndex = newActions.findIndex((a) => a.type === actionType);
      if (key === 'enabled') {
        if (value && actionIndex === -1) {
          // Add the action if it's enabled and not present
          const defaultLabel = actionType === 'submit' ? '提交' : '保存草稿';
          newActions.push({ type: actionType, label: defaultLabel });
        } else if (!value && actionIndex > -1) {
          // Remove the action if it's disabled and present
          newActions.splice(actionIndex, 1);
        }
      } else if (key === 'label' && actionIndex > -1) {
        // Update the label
        newActions[actionIndex] = { ...newActions[actionIndex], label: value };
      }
      return { ...prev, actions: newActions };
    });
  };
  const submitAction = form.actions?.find((a) => a.type === 'submit');
  const saveDraftAction = form.actions?.find((a) => a.type === 'save_draft');
  return (
    <div style={{ padding: '16px', height: '100%', overflowY: 'auto' }}>
      <Form layout="vertical">
        <Form.Item label="表单名称">
          <Input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </Form.Item>
        <Form.Item label="表单说明">
          <Input.TextArea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            autoSize={{ minRows: 4, maxRows: 8 }}
            placeholder="支持 Markdown 格式"
          />
        </Form.Item>
        <Form.Item>
          <Checkbox
            checked={form.showIndex || false}
            onChange={(e) => setForm((prev) => ({ ...prev, showIndex: e.target.checked }))}
          >
            显示序号
          </Checkbox>
        </Form.Item>
        <Divider orientation="left" plain>
          操作按钮
        </Divider>
        <Row align="middle" style={{ marginBottom: '16px' }}>
          <Col span={10}>
            <Checkbox
              checked={!!submitAction}
              onChange={(e) => handleActionChange('submit', 'enabled', e.target.checked)}
            >
              提交
            </Checkbox>
          </Col>
          <Col span={14}>
            {submitAction && (
              <Form.Item noStyle>
                <Input
                  addonBefore="文案"
                  value={submitAction.label}
                  onChange={(e) => handleActionChange('submit', 'label', e.target.value)}
                />
              </Form.Item>
            )}
          </Col>
        </Row>
        <Row align="middle">
          <Col span={10}>
            <Checkbox
              checked={!!saveDraftAction}
              onChange={(e) => handleActionChange('save_draft', 'enabled', e.target.checked)}
            >
              保存草稿
            </Checkbox>
          </Col>
          <Col span={14}>
            {saveDraftAction && (
              <Form.Item noStyle>
                <Input
                  addonBefore="文案"
                  value={saveDraftAction.label}
                  onChange={(e) => handleActionChange('save_draft', 'label', e.target.value)}
                />
              </Form.Item>
            )}
          </Col>
        </Row>
      </Form>
    </div>
  );
};

const PropertiesEditor = ({ selectedField, updateField, form, setForm, appId }) => {
  const plugin = selectedField ? componentRegistry.get(selectedField.type) : null;
  const [activeTab, setActiveTab] = React.useState('form');
  React.useEffect(() => {
    if (selectedField) {
      setActiveTab('field');
    } else {
      setActiveTab('form');
    }
  }, [selectedField]);

  const showLayoutControls = plugin && plugin.type !== 'divider';

  const fieldProperties = (
    <div style={{ padding: '8px', height: '100%', overflowY: 'auto' }}>
      {plugin ? (
        <Form layout="vertical">
          <plugin.propertiesComponent
            field={selectedField}
            updateField={updateField}
            appId={appId}
            currentForm={form}
            currentFormId={form?._id || form?.id}
          />
          {showLayoutControls && (
            <>
              <SectionHeader title="字段宽度" />
              <LayoutProperties
                field={selectedField}
                updateField={(fieldId, newLayoutProps) =>
                  updateField(fieldId, newLayoutProps, 'layout')
                }
              />
            </>
          )}
        </Form>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>请在左侧画布中选择一个字段</div>
      )}
    </div>
  );

  const items = [
    {
      key: 'field',
      label: `字段属性`,
      children: fieldProperties,
    },
    {
      key: 'form',
      label: `表单属性`,
      children: <FormProperties form={form} setForm={setForm} />,
    },
  ];

  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      centered
      items={items}
      style={{ height: '100%', overflow: 'auto' }}
    />
  );
};

export default PropertiesEditor;
