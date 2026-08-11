import React, { useState, useEffect } from 'react';
import { Select, Alert, Table, Tag, Typography, Button, message, Card, Divider } from 'antd';
import { CopyOutlined, InfoCircleOutlined, CodeOutlined } from '@ant-design/icons';
import { getFormsByAppId, getForm } from '../../../../api/forms';

const { Text, Paragraph } = Typography;

const FormSelector = ({ value, onChange, appId, placeholder }) => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 选中的表单详情，用于渲染字段参考面板与生成 JSON 示例
  const [selectedFormDetail, setSelectedFormDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 1. 加载应用下的表单列表
  useEffect(() => {
    if (!appId) return;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getFormsByAppId(appId);
        setForms(res || []);
      } catch (e) {
        console.error('Failed to load forms in FormSelector', e);
        setError('加载表单列表失败');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [appId]);

  // 2. 加载选中的表单详情（用于获取字段定义列表）
  useEffect(() => {
    if (!value || !appId) {
      setSelectedFormDetail(null);
      return;
    }
    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const detail = await getForm(appId, value);
        setSelectedFormDetail(detail);
      } catch (e) {
        console.error('Failed to load form details in FormSelector', e);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [value, appId]);

  // 3. 处理复制文本
  const handleCopyText = (textToCopy, successMsg) => {
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        message.success(successMsg || '已复制到剪贴板');
      })
      .catch((err) => {
        console.error('Failed to copy', err);
        message.error('复制失败，请手动选择复制');
      });
  };

  // 友情映射常见低代码字段类型到易读的中文类型
  const formatFieldType = (type) => {
    const typesMap = {
      'text': '单行文本',
      'textarea': '多行文本',
      'number': '数字',
      'select': '单选下拉',
      'dropdown': '下拉选择',
      'radio': '单选框',
      'radio-group': '单选框组',
      'checkbox': '多选框',
      'checkbox-group': '多选框组',
      'dropdown-checkbox': '下拉多选',
      'date': '日期选择',
      'datePicker': '日期选择',
      'upload': '附件/文件上传',
      'file': '文件',
      'richtext': '富文本'
    };
    return typesMap[type] || type || '普通数据';
  };

  // 过滤并处理可落库写入的有效数据字段
  const getRecordableFields = () => {
    if (!selectedFormDetail || !selectedFormDetail.fields) return [];
    
    return selectedFormDetail.fields
      .filter(f => f && f.recordable !== false && f.type !== 'placeholder')
      .map(f => {
        const label = f.properties?.label || f.label || '未命名字段';
        const required = !!f.validation?.required;
        return {
          key: f.id,
          id: f.id,
          label: label,
          type: f.type,
          required: required
        };
      });
  };

  // 根据当前表单字段，动态生成 JSON 写入骨架示例，填充格式为 "Label, 字段类型" 供 AI 识别
  const generateJsonExample = (fields) => {
    if (!fields || fields.length === 0) return '{}';
    
    const exampleObj = {};
    fields.forEach((f) => {
      const typeText = formatFieldType(f.type);
      exampleObj[f.id] = `${f.label}, ${typeText}`;
    });

    return JSON.stringify(exampleObj, null, 2);
  };

  // 定义字段表格的列
  const columns = [
    {
      title: '字段名称',
      dataIndex: 'label',
      key: 'label',
      width: '35%',
      render: (text, record) => (
        <Text strong style={{ fontSize: 11 }}>
          {text} {record.required && <span style={{ color: '#ff4d4f' }}>*</span>}
        </Text>
      )
    },
    {
      title: '参数键 (Key)',
      dataIndex: 'id',
      key: 'id',
      width: '35%',
      render: (text) => <Text code style={{ fontSize: 11 }}>{text}</Text>
    },
    {
      title: '数据类型',
      dataIndex: 'type',
      key: 'type',
      width: '20%',
      render: (text) => <Tag color="blue" style={{ fontSize: 10 }}>{formatFieldType(text)}</Tag>
    },
    {
      title: '操作',
      key: 'action',
      width: '10%',
      align: 'center',
      render: (_, record) => (
        <Button 
          type="text" 
          size="small" 
          icon={<CopyOutlined style={{ fontSize: 11 }} />} 
          onClick={() => handleCopyText(record.id, `Key "${record.id}" 已复制`)}
          title="复制字段 Key"
        />
      )
    }
  ];

  if (error) {
    return <Alert message={error} type="error" showIcon style={{ padding: '4px 8px' }} />;
  }

  const recordableFields = getRecordableFields();
  const jsonExampleStr = generateJsonExample(recordableFields);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 1. 表单选择下拉框 */}
      <Select
        value={value}
        onChange={onChange}
        loading={loading}
        placeholder={placeholder || '请选择目标表单'}
        showSearch
        optionFilterProp="label"
        options={forms.map((f) => ({
          label: f.name || '未命名表单',
          value: f.id || f._id,
        }))}
        style={{ width: '100%' }}
      />

      {/* 2. 精美的字段参考面板 (只有在选择表单后呈现) */}
      {value && selectedFormDetail && (
        <Card
          size="small"
          loading={loadingDetail}
          style={{
            background: '#fafafa',
            borderRadius: 8,
            border: '1px solid #f0f0f0',
            marginTop: 4
          }}
          bodyStyle={{ padding: '12px' }}
        >
          {/* A. 字段列表 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 12 }} />
            <Text strong style={{ fontSize: 12, color: '#262626' }}>
              表单字段参数参考
            </Text>
          </div>
          
          <Paragraph style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 12 }}>
            点击字段行右侧图标可单独复制 Key。
          </Paragraph>

          {recordableFields.length > 0 ? (
            <>
              <Table
                dataSource={recordableFields}
                columns={columns}
                pagination={false}
                size="small"
                bordered={false}
                style={{ background: 'transparent' }}
                rowClassName={() => 'custom-table-row'}
              />

              <Divider style={{ margin: '12px 0' }} />

              {/* B. 动态 JSON 示例展示与复制 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CodeOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                  <Text strong style={{ fontSize: 12, color: '#262626' }}>
                    一键复制 JSON 示例模板
                  </Text>
                </div>
                <Button 
                  type="primary" 
                  ghost 
                  size="small" 
                  icon={<CopyOutlined style={{ fontSize: 11 }} />}
                  style={{ fontSize: 11, height: 22, padding: '0 8px' }}
                  onClick={() => handleCopyText(jsonExampleStr, 'JSON 示例模板已成功复制！')}
                >
                  复制整段 JSON
                </Button>
              </div>

              <pre 
                style={{
                  background: '#f5f5f5',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #e8e8e8',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: '#555',
                  maxHeight: 180,
                  overflowY: 'auto',
                  margin: 0
                }}
              >
                {jsonExampleStr}
              </pre>
            </>
          ) : (
            <Alert message="该表单没有任何可写入的数据字段" type="warning" showIcon style={{ fontSize: 11, padding: '4px 8px' }} />
          )}
        </Card>
      )}
    </div>
  );
};

export default FormSelector;
