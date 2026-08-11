import React from 'react';
import {
  Switch,
  Input,
  Select,
  Checkbox,
  Button,
  Space,
  Divider,
  Tag,
  Typography,
} from 'antd';
import {
  ThunderboltOutlined,
  PlusOutlined,
  DeleteOutlined,
  CalendarOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import CategorySelect from '../../../components/common/CategorySelect';
import ResizableDrawer from '../../../components/common/ResizableDrawer';

const { Text } = Typography;

/**
 * DocumentPropertiesDrawer
 * A Notion-style right-side drawer showing document metadata (tags, timestamps)
 * and Skill configuration (toggle, name, description, parameters).
 */
export default function DocumentPropertiesDrawer({
  open,
  onClose,

  // Document meta
  currentDoc,
  localTags,
  onTagsChange,
  onTagsDropdownOpenChange,
  tagCategories,
  isEditable,

  // Skill state
  purpose,
  isSkill,
  skillName,
  skillDescription,
  paramsList,
  onPurposeChange,
  onSkillNameChange,
  onSkillDescChange,
  onParamsListChange,
}) {
  const { t } = useTranslation();

  const lastUpdatedText = currentDoc?.updatedAt
    ? new Date(currentDoc.updatedAt).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <ResizableDrawer
      title={
        <Space size={8}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {t('documentPropertiesDrawer.title', '文档属性')}
          </span>
        </Space>
      }
      placement="right"
      defaultWidth={360}
      minWidth={300}
      maxWidth="80vw"
      open={open}
      onClose={onClose}
      mask={true}
      maskClosable={true}
      styles={{
        body: { padding: '16px 20px', overflowY: 'auto' },
        header: { padding: '14px 20px', borderBottom: '1px solid #f0f0f0' },
      }}
    >
      {/* ── Meta: Updated At ── */}
      {lastUpdatedText && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarOutlined />
            {t('common.updatedAt', '更新时间')}
          </div>
          <Text style={{ fontSize: 13, color: '#595959' }}>{lastUpdatedText}</Text>
        </div>
      )}

      {/* ── Tags ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <TagsOutlined />
          {t('documentResourcePanel.tags', '标签')}
        </div>
        <CategorySelect
          value={localTags}
          onChange={onTagsChange}
          onDropdownVisibleChange={onTagsDropdownOpenChange}
          categories={tagCategories}
          disabled={!isEditable}
          size="small"
          style={{ width: '100%' }}
        />
      </div>

      <Divider style={{ margin: '0 0 16px 0' }} />

      {/* ── Skill Config ── */}
      <div>
        {/* Header row with toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isSkill ? 16 : 0 }}>
          <Space size={8}>
            <ThunderboltOutlined style={{ color: isSkill ? '#722ed1' : '#8c8c8c', fontSize: 16 }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: isSkill ? '#531dab' : '#262626' }}>
              {t('documentResourcePanel.agentSkillConfig', 'Agent 智能技能')}
            </span>
          </Space>
          <Select
            size="small"
            value={purpose || 'NORMAL'}
            onChange={onPurposeChange}
            disabled={!isEditable}
            style={{ width: 140 }}
            options={[
              { value: 'NORMAL', label: t('documentResourcePanel.purposeNormal', '普通文档') },
              { value: 'KNOWLEDGE', label: t('documentResourcePanel.purposeKnowledge', '静态知识') },
              { value: 'SKILL', label: t('documentResourcePanel.purposeSkill', '智能技能') },
            ]}
          />
        </div>

        {(purpose === 'SKILL' || purpose === 'KNOWLEDGE') && (
          <div style={{ animation: 'fadeIn 0.2s ease', marginTop: 16 }}>
            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#595959', marginBottom: 4 }}>
                {t('documentResourcePanel.descriptionLabel', '描述')}
                <span style={{ color: 'red' }}> *</span>
              </div>
              <Input.TextArea
                size="small"
                rows={3}
                placeholder={purpose === 'SKILL' 
                  ? "e.g. Use this tool to query the tax rate..." 
                  : "e.g. This document describes the company leave policies..."}
                value={skillDescription}
                disabled={!isEditable}
                onChange={(e) => onSkillDescChange(e.target.value)}
                style={{ borderRadius: 6 }}
              />
            </div>

            {purpose === 'SKILL' && (
              <>
                {/* Skill Name */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#595959', marginBottom: 4 }}>
                    {t('documentResourcePanel.toolIdentifier', '工具标识')}
                    <span style={{ color: 'red' }}> *</span>
                  </div>
                  <Input
                    size="small"
                    placeholder="e.g. query_tax_rate"
                    value={skillName}
                    disabled={!isEditable}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                      onSkillNameChange(val);
                    }}
                    style={{ borderRadius: 6 }}
                  />
                </div>

                {/* Parameters */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#595959' }}>
                      {t('documentResourcePanel.parametersLabel', '输入参数')}
                    </span>
                    {isEditable && (
                      <Button
                        type="dashed"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() =>
                          onParamsListChange([...paramsList, { name: '', type: 'string', description: '', required: false }])
                        }
                        style={{ borderRadius: 4, fontSize: 12 }}
                      >
                        {t('documentResourcePanel.addParameter', '添加参数')}
                      </Button>
                    )}
                  </div>

                  {paramsList.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#bfbfbf', fontSize: 12, border: '1px dashed #e8e8e8', borderRadius: 8 }}>
                      {t('documentResourcePanel.noParameters', '暂无输入参数')}
                    </div>
                  ) : (
                    <div style={{ border: '1px solid #edece9', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#fafafa', borderBottom: '1px solid #edece9' }}>
                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>
                              {t('documentResourcePanel.paramName', '参数名')}
                            </th>
                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500, width: 80 }}>
                              {t('documentResourcePanel.paramType', '类型')}
                            </th>
                            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 500, width: 40 }}>
                              {t('documentResourcePanel.paramReq', '必填')}
                            </th>
                            {isEditable && <th style={{ width: 32 }} />}
                          </tr>
                        </thead>
                        <tbody>
                          {paramsList.map((param, idx) => (
                            <React.Fragment key={idx}>
                              <tr style={{ borderBottom: 'none' }}>
                                <td style={{ padding: '6px 8px 2px 8px' }}>
                                  <Input
                                    size="small"
                                    placeholder="param_name"
                                    value={param.name}
                                    disabled={!isEditable}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                                      const newParams = [...paramsList];
                                      newParams[idx] = { ...newParams[idx], name: val };
                                      onParamsListChange(newParams);
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px 2px 8px' }}>
                                  <Select
                                    size="small"
                                    value={param.type}
                                    disabled={!isEditable}
                                    onChange={(val) => {
                                      const newParams = [...paramsList];
                                      newParams[idx] = { ...newParams[idx], type: val };
                                      onParamsListChange(newParams);
                                    }}
                                    style={{ width: '100%' }}
                                    options={[
                                      { value: 'string', label: 'str' },
                                      { value: 'number', label: 'num' },
                                      { value: 'boolean', label: 'bool' },
                                      { value: 'array', label: 'arr' },
                                      { value: 'object', label: 'obj' },
                                    ]}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px 2px 8px', textAlign: 'center' }}>
                                  <Checkbox
                                    checked={param.required}
                                    disabled={!isEditable}
                                    onChange={(e) => {
                                      const newParams = [...paramsList];
                                      newParams[idx] = { ...newParams[idx], required: e.target.checked };
                                      onParamsListChange(newParams);
                                    }}
                                  />
                                </td>
                                {isEditable && (
                                  <td style={{ padding: '6px 6px 2px 6px', textAlign: 'center' }}>
                                    <Button
                                      type="text"
                                      danger
                                      size="small"
                                      icon={<DeleteOutlined />}
                                      onClick={() => onParamsListChange(paramsList.filter((_, i) => i !== idx))}
                                    />
                                  </td>
                                )}
                              </tr>
                              <tr style={{ borderBottom: '1px solid #f5f5f5' }}>
                                <td colSpan={isEditable ? 4 : 3} style={{ padding: '2px 8px 6px 8px' }}>
                                  <Input
                                    size="small"
                                    placeholder={t('documentResourcePanel.paramDescPlaceholder', '参数描述/说明...')}
                                    value={param.description || ''}
                                    disabled={!isEditable}
                                    onChange={(e) => {
                                      const newParams = [...paramsList];
                                      newParams[idx] = { ...newParams[idx], description: e.target.value };
                                      onParamsListChange(newParams);
                                    }}
                                    style={{
                                      fontSize: '11px',
                                      color: '#595959',
                                      background: '#fafafa',
                                      borderColor: '#f0f0f0',
                                      borderRadius: 4,
                                    }}
                                  />
                                </td>
                              </tr>
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </ResizableDrawer>
  );
}
