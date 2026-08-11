import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Tree,
  Space,
  Tag,
  Typography,
  Tooltip,
  Empty,
  Row,
  Col,
  Card,
  Divider,
  Splitter,
  theme,
  ConfigProvider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApartmentOutlined,
  CodeOutlined,
  ControlOutlined,
  RightOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import GenericTree from '../../../components/common/GenericTree/GenericTree';
import XMarkdownDisplay from '../../../components/common/XMarkdownDisplay';

const { Text, Title, Paragraph } = Typography;

const JsonSchemaEditor = ({ value, onChange, title }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState('root');
  const [expandedKeys, setExpandedKeys] = useState(['root']);
  const [form] = Form.useForm();

  const schema = useMemo(() => value || { type: 'object', properties: {}, required: [] }, [value]);

  // 类型颜色映射
  const typeColors = {
    string: token.colorSuccess,
    number: token.colorWarning,
    boolean: token.colorError,
    object: token.colorPrimary,
    array: token.colorInfo,
  };

  const handleOpen = () => {
    setIsModalOpen(true);
    setSelectedKey('root');
    setExpandedKeys(['root']);
  };

  const updateSchema = (updater) => {
    const newSchema = JSON.parse(JSON.stringify(schema));
    updater(newSchema);
    onChange(newSchema);
  };

  const findNodeByPath = (root, pathKey) => {
    if (pathKey === 'root') return { node: root, parent: null, name: 'root', path: [] };
    const parts = pathKey.split('.').slice(1);
    let current = root;
    let parent = null;
    let name = 'root';
    const path = [];
    for (let i = 0; i < parts.length; i++) {
      parent = current;
      name = parts[i];
      path.push(name);
      if (!current.properties || !current.properties[name]) return { node: null };
      current = current.properties[name];
    }
    return { node: current, parent, name, path };
  };

  const handleAdd = (parentPathKey) => {
    const { node } = findNodeByPath(schema, parentPathKey);
    if (!node || node.type !== 'object') return;
    let index = 1;
    while (node.properties && node.properties[`property_${index}`]) index++;
    const newPropName = `property_${index}`;
    updateSchema((draft) => {
      const target = findNodeByPath(draft, parentPathKey).node;
      if (!target.properties) target.properties = {};
      target.properties[newPropName] = { type: 'string', description: '' };
      if (!expandedKeys.includes(parentPathKey)) setExpandedKeys([...expandedKeys, parentPathKey]);
    });
    setSelectedKey(`${parentPathKey}.${newPropName}`);
  };

  const handleDelete = (pathKey) => {
    if (pathKey === 'root') return;
    const parts = pathKey.split('.');
    const nameToDelete = parts.pop();
    const parentPathKey = parts.join('.');
    updateSchema((draft) => {
      const parentNode = findNodeByPath(draft, parentPathKey).node;
      if (parentNode && parentNode.properties) {
        delete parentNode.properties[nameToDelete];
        parentNode.required = (parentNode.required || []).filter((r) => r !== nameToDelete);
      }
    });
    if (selectedKey === pathKey) setSelectedKey(parentPathKey);
  };

  const handeFormChange = () => {
    const values = form.getFieldsValue();
    if (selectedKey === 'root' || !values.name) return;
    const parts = selectedKey.split('.');
    const oldName = parts.pop();
    const parentPathKey = parts.join('.');

    // Destructure values to separate schema properties from metadata
    const { name: fieldName, required: isRequired, ...rest } = values;

    updateSchema((draft) => {
      const parentNode = findNodeByPath(draft, parentPathKey).node;
      if (!parentNode) return;

      if (fieldName !== oldName) {
        if (parentNode.properties[fieldName]) return;
        const data = parentNode.properties[oldName];
        delete parentNode.properties[oldName];

        // Clean old data if it had metadata
        const cleanData = { ...data };
        delete cleanData.name;
        delete cleanData.required;

        // Only include non-metadata values in the property definition
        parentNode.properties[fieldName] = { ...cleanData, ...rest };

        parentNode.required = (parentNode.required || []).filter((r) => r !== oldName);
        if (isRequired && !parentNode.required.includes(fieldName)) {
          parentNode.required.push(fieldName);
        }
        setSelectedKey(`${parentPathKey}.${fieldName}`);
      } else {
        // Update existing property
        const currentProp = parentNode.properties[fieldName];
        // Ensure no metadata leaked in
        delete currentProp.name;
        delete currentProp.required;

        parentNode.properties[fieldName] = { ...currentProp, ...rest };

        if (rest.type === 'object' && !parentNode.properties[fieldName].properties) {
          parentNode.properties[fieldName].properties = {};
          parentNode.properties[fieldName].required = [];
        }

        const requiredArr = parentNode.required || [];
        if (isRequired) {
          if (!requiredArr.includes(fieldName)) {
            parentNode.required = [...requiredArr, fieldName];
          }
        } else {
          parentNode.required = requiredArr.filter((r) => r !== fieldName);
        }
      }
    });
  };

  useEffect(() => {
    if (selectedKey && selectedKey !== 'root') {
      const { node, name, parent } = findNodeByPath(schema, selectedKey);
      if (node) {
        form.setFieldsValue({
          name: name,
          type: node.type,
          description: node.description,
          required: parent?.required?.includes(name) || false,
        });
      }
    }
  }, [selectedKey, schema, form]);

  const prepareTreeNodes = (properties = {}, pathKey = 'root') => {
    return Object.entries(properties).map(([name, data]) => {
      const currentKey = `${pathKey}.${name}`;
      const isObject = data.type === 'object';
      return {
        key: currentKey,
        name,
        type: data.type,
        isObject,
        children: isObject ? prepareTreeNodes(data.properties, currentKey) : null,
      };
    });
  };

  const treeData = useMemo(
    () => [
      {
        key: 'root',
        name: title,
        isRoot: true,
        isObject: true,
        children: prepareTreeNodes(schema.properties, 'root'),
      },
    ],
    [schema, title],
  );

  const renderIcon = (node) => {
    if (node.isRoot) return <ApartmentOutlined style={{ color: token.colorPrimary }} />;
    return null;
  };

  const renderTitle = (node) => {
    if (node.isRoot) return node.name;
    return (
      <Space size={8}>
        <Text style={{ fontSize: 13 }}>{node.name}</Text>
        <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace', opacity: 0.6 }}>
          {node.type}
        </Text>
      </Space>
    );
  };

  const renderActions = (node) => {
    return (
      <Space size={4}>
        {node.isObject && (
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined style={{ fontSize: 12 }} />}
            onClick={(e) => {
              e.stopPropagation();
              handleAdd(node.key);
            }}
            className="gt-action-btn"
          />
        )}
        {!node.isRoot && (
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined style={{ fontSize: 12 }} />}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(node.key);
            }}
            className="gt-action-btn"
          />
        )}
      </Space>
    );
  };

  const renderEditor = () => {
    if (selectedKey === 'root') {
      return (
        <div
          style={{
            textAlign: 'center',
            padding: '100px 40px',
            minHeight: 400,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              background: token.colorBgLayout,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <ControlOutlined style={{ fontSize: 20, color: token.colorTextSecondary }} />
          </div>
          <Title level={5} style={{ marginBottom: 8, fontWeight: 500 }}>
            {t('workflow.designer.editSchema')}
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 24, fontSize: 13 }}>
            {t('workflow.designer.rootConfigHint')}
          </Paragraph>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd('root')}>
            {t('workflow.nodes.common.addParameter')}
          </Button>
        </div>
      );
    }
    return (
      <Form form={form} layout="vertical" onValuesChange={handeFormChange} requiredMark={false}>
        <div
          style={{
            marginBottom: 20,
            paddingBottom: 12,
            borderBottom: `1px solid ${token.colorBorder}`,
          }}
        >
          <Title level={5} style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>
            {t('workflow.designer.propertySettings')}
          </Title>
        </div>

        <Form.Item
          name="name"
          label={<Text style={{ fontSize: 13 }}>{t('workflow.nodes.common.paramName')}</Text>}
          rules={[{ required: true, message: '请输入参数名称' }]}
        >
          <Input placeholder="例如: user_id" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={14}>
            <Form.Item
              name="type"
              label={<Text style={{ fontSize: 13 }}>{t('workflow.nodes.common.paramType')}</Text>}
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: 'string', label: 'String' },
                  { value: 'number', label: 'Number' },
                  { value: 'boolean', label: 'Boolean' },
                  { value: 'object', label: 'Object' },
                  { value: 'array', label: 'Array' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item
              name="required"
              label={<Text style={{ fontSize: 13 }}>{t('common.required')}</Text>}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label={<Text style={{ fontSize: 13 }}>{t('common.description')}</Text>}
        >
          <Input.TextArea
            rows={4}
            placeholder={t('workflow.nodes.common.descriptionPlaceholder')}
          />
        </Form.Item>

        {form.getFieldValue('type') === 'object' && (
          <div
            style={{
              marginTop: 16,
              padding: '12px',
              background: token.colorInfoBg,
              borderRadius: 6,
              border: `1px solid ${token.colorInfoBorder}`,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('workflow.designer.objectTip')}
            </Text>
          </div>
        )}
      </Form>
    );
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Text strong style={{ fontSize: 13, color: token.colorTextSecondary }}>
          {title}
        </Text>
        <Button
          size="small"
          type="link"
          icon={<EditOutlined />}
          onClick={handleOpen}
          style={{ padding: 0 }}
        >
          {t('common.edit')}
        </Button>
      </div>
      <div
        style={{
          background: token.colorFillAlter,
          padding: '8px',
          borderRadius: 8,
          border: `1px dashed ${token.colorBorder}`,
          cursor: 'pointer',
          minHeight: 48,
          position: 'relative',
        }}
      >
        {Object.keys(schema.properties || {}).length > 0 ? (
          <div
            onClick={(e) => {
              // If clicking on the code display area (the padding), open modal.
              // But let XMarkdownDisplay handle its own clicks (like copy button)
            }}
          >
            <XMarkdownDisplay>
              {`\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``}
            </XMarkdownDisplay>
          </div>
        ) : (
          <div
            style={{
              padding: '12px 16px',
              width: '100%',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              <PlusOutlined style={{ marginRight: 4 }} />
              {t('common.noData')}
            </Text>
          </div>
        )}
      </div>
      <Modal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={[
          <Button
            key="done"
            type="primary"
            onClick={() => setIsModalOpen(false)}
            style={{ borderRadius: 6, minWidth: 80 }}
          >
            {t('workflow.designer.done')}
          </Button>,
        ]}
        width={840}
        centered
        styles={{ body: { padding: 0 } }}
        closable={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: 560 }}>
          <div
            style={{
              padding: '16px 24px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#fff',
            }}
          >
            <Space>
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: token.colorPrimaryBg,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ApartmentOutlined style={{ color: token.colorPrimary }} />
              </div>
              <div>
                <Text strong style={{ fontSize: 15, display: 'block', lineHeight: 1.2 }}>
                  {t('workflow.designer.editSchema')}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('workflow.designer.schemaHint')}
                </Text>
              </div>
            </Space>
            <Tag color="blue" bordered={false} style={{ margin: 0 }}>
              {title}
            </Tag>
          </div>
          <Splitter style={{ flex: 1, overflow: 'hidden' }}>
            <Splitter.Panel defaultSize="35%" min="25%" max="50%">
              <div
                style={{
                  padding: '16px 8px',
                  height: '100%',
                  overflowY: 'auto',
                  background: token.colorBgContainer,
                }}
              >
                <div
                  style={{
                    padding: '0 12px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text strong style={{ fontSize: 12, color: token.colorTextSecondary }}>
                    {t('workflow.designer.structure')}
                  </Text>
                </div>

                <GenericTree
                  treeData={treeData}
                  selectedKeys={[selectedKey]}
                  expandedKeys={expandedKeys}
                  onSelect={(keys) => keys[0] && setSelectedKey(keys[0])}
                  onExpand={setExpandedKeys}
                  renderIcon={renderIcon}
                  renderTitle={renderTitle}
                  renderActions={renderActions}
                />
              </div>
            </Splitter.Panel>
            <Splitter.Panel>
              <div
                style={{
                  padding: '32px 40px',
                  height: '100%',
                  overflowY: 'auto',
                  background: '#fff',
                }}
              >
                {renderEditor()}
              </div>
            </Splitter.Panel>
          </Splitter>
        </div>
      </Modal>
    </div>
  );
};

export default JsonSchemaEditor;
