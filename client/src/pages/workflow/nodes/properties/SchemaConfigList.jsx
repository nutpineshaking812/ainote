import React, { useEffect, useRef, useMemo } from 'react';
import {
  Form,
  Input,
  Button,
  Space,
  Select,
  Typography,
  Divider,
  Tooltip,
  Checkbox,
  Tag,
  Modal,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ControlOutlined,
  ExportOutlined,
  LockOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import WorkflowFieldRenderer, { renderWorkflowFormItems } from '../../../../components/common/WorkflowFieldRenderer';
import { PROPERTY_INPUTS_REGISTRY, PROPERTY_INPUT_LABELS } from '../../components/PropertyInputs';
import { STANDARD_SYSTEM_INPUTS } from '../../constants';

const { Text } = Typography;

/**
 * 💡 n8n Style Schema Editor
 */
const SchemaConfigList = ({
  mode = 'input',
  label,
  name,
  node,
  setNodes,
  nodes = [],
  currentNodeId,
}) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const fieldName = name || (mode === 'input' ? 'inputs' : 'outputs');
  const displayLabel = label || (mode === 'input' ? '输入' : '输出');

  const lastNodeIdRef = useRef(null);
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = React.useState(false);


  const schemaFields = useMemo(() => {
    if (!node?.id) return [];
    const nodeData = node.data?.[fieldName] || [];
    const legacyData = mode === 'input' ? node.data?.params : node.data?.mapping;
    let finalData = nodeData.length === 0 && legacyData ? legacyData : nodeData;

    // 只有在输入模式时，强制系统变量排在末尾
    if (mode === 'input') {
      const systemNames = new Set(STANDARD_SYSTEM_INPUTS.map((v) => v.name));
      
      // 1. 提取并保留数据库中已有的系统参数的实际值 (如 value/required 等属性)
      const existingSystemMap = new Map();
      finalData.forEach((item) => {
        if (item && systemNames.has(item.name)) {
          existingSystemMap.set(item.name, item);
        }
      });

      // 2. 过滤掉用户数据中可能存在的系统变量 (防止重复且用于重新排版)
      const userDefinedData = finalData.filter((f) => f && !systemNames.has(f.name));

      // 3. 将静态定义与已保存的实际值进行 merge，确保原有字段的值不丢失
      const systemFields = STANDARD_SYSTEM_INPUTS.map((sysField) => {
        const existing = existingSystemMap.get(sysField.name);
        return {
          ...sysField,
          ...existing, // 优先使用已保存的字段属性（如 value）
        };
      });

      // 4. 重新拼接：业务参数在前，系统参数统一在后
      finalData = [...userDefinedData, ...systemFields];
    }
    return finalData;
  }, [node?.id, node?.data, fieldName, mode]);

  useEffect(() => {
    if (!form || !node?.id) return;

    // 💡 检查当前表单值是否与计算出的 schemaFields 结构不一致 (长度或字段 Key/Type 不匹配)
    const currentFormValue = form.getFieldValue(fieldName);
    const needsSync = !currentFormValue || 
      currentFormValue.length !== schemaFields.length ||
      currentFormValue.some((f, idx) => !f || f.name !== schemaFields[idx].name || f.type !== schemaFields[idx].type);

    if (needsSync) {
      form.setFieldValue(fieldName, schemaFields);
    }

    if (lastNodeIdRef.current !== node.id) {
      const nodeData = node.data?.[fieldName] || [];
      // 💡 不仅在长度不同时同步，在字段顺序、名称或类型不同时，也必须将排版规范后的 schemaFields 同步回 node.data
      const needsSyncBack = schemaFields.length !== nodeData.length ||
        schemaFields.some((f, idx) => !nodeData[idx] || f.name !== nodeData[idx].name || f.type !== nodeData[idx].type);

      if (needsSyncBack) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === node.id ? { ...n, data: { ...n.data, [fieldName]: schemaFields } } : n,
          ),
        );
      }

      lastNodeIdRef.current = node.id;
    }
  }, [form, fieldName, node?.id, schemaFields, setNodes]);

  const typeOptions = Array.from(
    new Set([...Object.keys(PROPERTY_INPUTS_REGISTRY), 'array', 'object'])
  ).map((key) => ({
    label: PROPERTY_INPUT_LABELS[key] || key.toUpperCase(),
    value: key,
  }));

  return (
    <div style={{ marginTop: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Space size={6}>
          {mode === 'input' ? (
            <ControlOutlined style={{ color: '#1677ff', fontSize: 13 }} />
          ) : (
            <ExportOutlined style={{ color: '#52c41a', fontSize: 13 }} />
          )}
          <Text strong style={{ fontSize: 12, color: '#444', textTransform: 'uppercase' }}>
            {displayLabel}
          </Text>
        </Space>
        <Button
          size="small"
          type="link"
          onClick={() => setIsAdvancedModalOpen(true)}
          style={{ fontSize: 12, padding: 0 }}
        >
          高级编辑
        </Button>
      </div>

      <Form.List name={fieldName}>
        {(fields) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {fields.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: '#bfbfbf', fontSize: 12, border: '1px dashed #f0f0f0', borderRadius: 8 }}>
                  {t('workflow.designer.noFieldsTip', '暂无配置参数，请点击右上方“高级编辑”进行添加')}
                </div>
              ) : (
                renderWorkflowFormItems(
                  schemaFields,
                  null,
                  nodes,
                  currentNodeId || node?.id,
                  {
                    isFormList: true,
                    useVariableInput: true,
                    isDesignerMode: true,
                  }
                )
              )}
            </div>
        )}
      </Form.List>

      <Modal
        title={t('workflow.designer.advancedEdit', 'Advanced Parameter Editor')}
        open={isAdvancedModalOpen}
        onCancel={() => setIsAdvancedModalOpen(false)}
        onOk={() => setIsAdvancedModalOpen(false)}
        width={1000}
        centered
        destroyOnClose
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto', marginTop: 20 }}>
          <Form.List name={fieldName}>
            {(fields, { add, remove, move }) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '0 8px',
                    borderBottom: '1px solid #f0f0f0',
                    paddingBottom: 8,
                  }}
                >
                  <div style={{ width: 24 }}>
                    <Text strong style={{ fontSize: 12 }}>
                      #
                    </Text>
                  </div>
                  <div style={{ width: 140 }}>
                    <Text strong style={{ fontSize: 12 }}>
                      {t('workflow.designer.paramKey', '变量名 (Key)')}
                    </Text>
                  </div>
                  <div style={{ width: 140 }}>
                    <Text strong style={{ fontSize: 12 }}>
                      {t('workflow.designer.paramLabel', '显示名称 (Label)')}
                    </Text>
                  </div>
                  <div style={{ width: 150 }}>
                    <Text strong style={{ fontSize: 12 }}>
                      {t('workflow.designer.paramType', '数据类型')}
                    </Text>
                  </div>
                  <div style={{ width: 40, textAlign: 'center' }}>
                    <Text strong style={{ fontSize: 12 }}>
                      {t('workflow.designer.paramRequired', '必填')}
                    </Text>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 12 }}>
                      {mode === 'input'
                        ? t('workflow.designer.paramDescription', '描述 (Description)')
                        : t('workflow.designer.paramMapping', '映射 (Value / Mapping)')}
                    </Text>
                  </div>
                  <div style={{ width: 80, textAlign: 'right' }}>
                    <Text strong style={{ fontSize: 12 }}>
                      {t('workflow.designer.actions', '操作')}
                    </Text>
                  </div>
                </div>

                {fields.map(({ key, name: fName, ...restField }, index) => {
                  const currentItem = form.getFieldValue([fieldName, fName]);
                  const isSystem = currentItem?.isSystem === true;
                  const type = currentItem?.type || 'string';



                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: '8px',
                        background: isSystem ? '#fafafa' : '#fff',
                        borderRadius: 8,
                        border: '1px solid #f0f0f0',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ width: 24 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {index + 1}
                        </Text>
                      </div>
                      <Form.Item
                        {...restField}
                        name={[fName, 'name']}
                        noStyle
                        rules={[{ required: true }]}
                      >
                        <Input
                          size="small"
                          placeholder="Key"
                          disabled={isSystem}
                          style={{ width: 140 }}
                        />
                      </Form.Item>
                      <Form.Item {...restField} name={[fName, 'label']} noStyle>
                        <Input size="small" placeholder="Label" style={{ width: 140 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[fName, 'type']} noStyle>
                        <Select
                          size="small"
                          options={typeOptions}
                          disabled={isSystem}
                          style={{ width: 150 }}
                        />
                      </Form.Item>
                      <div style={{ width: 40, textAlign: 'center' }}>
                        <Form.Item
                          {...restField}
                          name={[fName, 'required']}
                          valuePropName="checked"
                          noStyle
                        >
                          <Checkbox disabled={isSystem} />
                        </Form.Item>
                      </div>
                      <div style={{ flex: 1 }}>
                        {mode === 'input' ? (
                          <Form.Item {...restField} name={[fName, 'description']} noStyle>
                            <Input.TextArea
                              size="small"
                              placeholder="参数用途描述..."
                              autoSize={{ minRows: 1, maxRows: 3 }}
                              style={{ fontSize: 12 }}
                            />
                          </Form.Item>
                        ) : (
                          <Form.Item
                            {...restField}
                            name={[fName, 'value']}
                            noStyle
                            rules={[{ required: true }]}
                            valuePropName="value"
                          >
                            <WorkflowFieldRenderer
                              field={currentItem}
                              currentNodeId={currentNodeId || node?.id}
                              useVariableInput={true}
                              size="small"
                            />
                          </Form.Item>
                        )}
                      </div>
                      <div
                        style={{ width: 80, display: 'flex', justifyContent: 'flex-end', gap: 0 }}
                      >
                        {!isSystem && (
                          <>
                            <Button
                              type="text"
                              size="small"
                              disabled={index === 0}
                              icon={<ArrowUpOutlined style={{ fontSize: 10 }} />}
                              onClick={() => move(index, index - 1)}
                            />
                            <Button
                              type="text"
                              size="small"
                              disabled={index === fields.length - 1}
                              icon={<ArrowDownOutlined style={{ fontSize: 10 }} />}
                              onClick={() => move(index, index + 1)}
                            />
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined style={{ fontSize: 10 }} />}
                              onClick={() => remove(fName)}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                <Button
                  type="dashed"
                  block
                  onClick={() =>
                    add({ name: `param_${fields.length + 1}`, type: 'string', required: false })
                  }
                  icon={<PlusOutlined />}
                  style={{ marginTop: 8 }}
                >
                  {t(
                    'workflow.designer.addParam',
                    `Add ${mode === 'input' ? 'Parameter' : 'Field'}`,
                  )}
                </Button>
              </div>
            )}
          </Form.List>
        </div>
      </Modal>
    </div>
  );
};

export default SchemaConfigList;
