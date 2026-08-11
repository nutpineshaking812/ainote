import React, { useState } from 'react';
import { Form, Select, Input, Button, Divider, Space, Card, Tag, Tooltip, Checkbox } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CheckOutlined,
  EditOutlined,
  FolderOutlined,
  UserOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import NodePropertyCollapse from './NodePropertyCollapse';
import SchemaConfigList from './SchemaConfigList';
import { PROPERTY_INPUTS_REGISTRY } from '../../components/PropertyInputs';

const FilterGroup = ({ field, remove, currentNodeId, appId, t, node, setNodes }) => {
  const FolderSelector = PROPERTY_INPUTS_REGISTRY.folder;
  const VariableInput = PROPERTY_INPUTS_REGISTRY.variableInput;
  const form = Form.useFormInstance();
  const groupData = Form.useWatch(['groups', field.name], form);

  // Persistence of mode: we use a hidden field in the form data
  const isConfirmed = groupData?._confirmed === true;

  const setConfirmed = (val) => {
    form.setFieldValue(['groups', field.name, '_confirmed'], val);

    // Sync to node data
    const currentGroups = form.getFieldsValue(true).groups;
    setNodes((nds) =>
      nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, groups: currentGroups } } : n)),
    );
  };

  const renderSummary = () => {
    if (!groupData) return null;
    const {
      type,
      name,
      parentId,
      parentName,
      appId: groupAppId,
      createdBy,
      createdAtStart,
      createdAtEnd,
      updatedAtStart,
      updatedAtEnd,
    } = groupData;

    const tags = [];

    // Type Tag
    const typeLabel =
      type && type !== 'all'
        ? t(`workflow.designer.resource.${type}`)
        : t('workflow.designer.allResources');
    tags.push(
      <Tag key="type" color="blue" icon={<CheckOutlined />}>
        {typeLabel}
      </Tag>,
    );

    if (groupData.includeChildren && type === 'document') {
      tags.push(
        <Tag key="includeChildren" color="cyan" icon={<AppstoreOutlined />}>
          {t('workflow.designer.includeChildren')}
        </Tag>,
      );
    }

    // Filters
    if (name)
      tags.push(
        <Tag key="name" color="green">
          "{name}" {groupData.includeSelf === false ? '(Exclude Self)' : ''}
        </Tag>,
      );
    tags.push(
      <Tag key="parentId" color="purple" icon={<FolderOutlined />}>
        {parentName || parentId} {groupData.includeParent ? '(+Parent)' : ''}
      </Tag>,
    );
    if (groupAppId)
      tags.push(
        <Tag key="appId" color="orange" icon={<AppstoreOutlined />}>
          {groupAppId}
        </Tag>,
      );
    if (createdBy)
      tags.push(
        <Tag key="createdBy" color="cyan" icon={<UserOutlined />}>
          {createdBy}
        </Tag>,
      );

    // Time Filters
    if (createdAtStart || createdAtEnd) {
      tags.push(
        <Tag key="createdAt" icon={<ClockCircleOutlined />}>
          {createdAtStart || '*'} ~ {createdAtEnd || '*'}
        </Tag>,
      );
    }

    if (updatedAtStart || updatedAtEnd) {
      tags.push(
        <Tag key="updatedAt" icon={<ClockCircleOutlined />}>
          Edit: {updatedAtStart || '*'} ~ {updatedAtEnd || '*'}
        </Tag>,
      );
    }

    // Default if only 'all' type and no filters
    const hasAnyFilter =
      name ||
      parentId ||
      groupAppId ||
      createdBy ||
      createdAtStart ||
      createdAtEnd ||
      updatedAtStart ||
      updatedAtEnd;
    if (!hasAnyFilter && type === 'all') {
      return (
        <span style={{ color: '#bfbfbf', fontSize: '12px', fontStyle: 'italic' }}>
          {t('workflow.designer.noFilters')}
        </span>
      );
    }

    return (
      <Space wrap size={[0, 4]}>
        {tags}
      </Space>
    );
  };

  return (
    <Card
      size="small"
      style={{
        marginBottom: 16,
        border: isConfirmed ? '1px solid #f0f0f0' : '1px solid #1890ff',
        background: isConfirmed ? '#fff' : '#f0faff',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <span style={{ fontWeight: 600 }}>
              {t('workflow.designer.filterGroup')} {field.name + 1}
            </span>
          </Space>
          <Space>
            {isConfirmed ? (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => setConfirmed(false)}
                style={{ fontSize: '12px' }}
              >
                {t('common.edit')}
              </Button>
            ) : (
              <Tooltip title={t('common.confirm')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined style={{ color: '#52c41a' }} />}
                  onClick={() => setConfirmed(true)}
                />
              </Tooltip>
            )}
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => remove(field.name)}
            />
          </Space>
        </div>
      }
    >
      <Form.Item name={[field.name, '_confirmed']} hidden>
        <Input />
      </Form.Item>
      <Form.Item name={[field.name, 'parentName']} hidden>
        <Input />
      </Form.Item>

      <div
        style={{
          padding: '8px 4px',
          cursor: 'pointer',
          display: isConfirmed ? 'block' : 'none',
        }}
        onClick={() => setConfirmed(false)}
      >
        {renderSummary()}
      </div>

      <div style={{ paddingTop: 8, display: isConfirmed ? 'none' : 'block' }}>
        <Form.Item
          label={t('workflow.designer.resourceType')}
          name={[field.name, 'type']}
          initialValue="all"
        >
          <Select
            options={[
              { label: t('workflow.designer.allResources'), value: 'all' },
              { label: t('workflow.designer.resource.form'), value: 'form' },
              { label: t('workflow.designer.resource.document'), value: 'document' },
              { label: t('workflow.designer.resource.view'), value: 'view' },
            ]}
          />
        </Form.Item>

        {groupData?.type === 'document' && (
          <Form.Item label={t('workflow.designer.parentDocument')} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Form.Item name={[field.name, 'parentId']} noStyle>
                <FolderSelector
                  appId={appId}
                  parentName={groupData?.parentName}
                  currentNodeId={currentNodeId || node?.id}
                  style={{ minWidth: 200, flex: 1 }}
                  onChange={(val, label) => {
                    const name = Array.isArray(label) ? label[0] : label;
                    form.setFieldValue(['groups', field.name, 'parentId'], val);
                    form.setFieldValue(['groups', field.name, 'parentName'], name);

                    // Sync to node data
                    const currentGroups = form.getFieldsValue(true).groups;
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === node.id ? { ...n, data: { ...n.data, groups: currentGroups } } : n,
                      ),
                    );
                  }}
                />
              </Form.Item>
              <Form.Item name={[field.name, 'includeParent']} valuePropName="checked" noStyle>
                <Checkbox style={{ marginLeft: 8 }}>
                  {t('workflow.designer.includeParent')}
                </Checkbox>
              </Form.Item>
            </div>
          </Form.Item>
        )}

        <Form.Item label={t('workflow.designer.resourceName')} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <Form.Item name={[field.name, 'name']} noStyle>
              <VariableInput
                placeholder="{{previousNode.name}}"
                currentNodeId={currentNodeId || node?.id}
                style={{ flex: 1 }}
              />
            </Form.Item>
            <Form.Item
              name={[field.name, 'includeSelf']}
              valuePropName="checked"
              initialValue={true}
              noStyle
            >
              <Checkbox style={{ marginLeft: 8 }}>{t('workflow.designer.multipleMatch')}</Checkbox>
            </Form.Item>
          </div>
        </Form.Item>

        {groupData?.type === 'document' && (
          <Form.Item
            name={[field.name, 'includeChildren']}
            valuePropName="checked"
            style={{ marginBottom: 24 }}
          >
            <Checkbox>{t('workflow.designer.includeChildren')}</Checkbox>
          </Form.Item>
        )}

        <Form.Item label={t('workflow.designer.appId')} name={[field.name, 'appId']}>
          <VariableInput
            placeholder="{{previousNode.appId}}"
            currentNodeId={currentNodeId || node?.id}
          />
        </Form.Item>

        <Form.Item label={t('workflow.designer.createdBy')} name={[field.name, 'createdBy']}>
          <VariableInput
            placeholder="{{previousNode.createdBy}}"
            currentNodeId={currentNodeId || node?.id}
          />
        </Form.Item>

        <Divider orientation="left" style={{ margin: '8px 0', fontSize: '12px', color: '#8c8c8c' }}>
          {t('workflow.history.triggerTime')}
        </Divider>
        <Space block direction="horizontal" style={{ width: '100%' }}>
          <Form.Item
            label={t('workflow.designer.startTime')}
            name={[field.name, 'createdAtStart']}
            style={{ marginBottom: 8, flex: 1 }}
          >
            <Input placeholder="YYYY-MM-DD" size="small" />
          </Form.Item>
          <Form.Item
            label={t('workflow.designer.endTime')}
            name={[field.name, 'createdAtEnd']}
            style={{ marginBottom: 8, flex: 1 }}
          >
            <Input placeholder="YYYY-MM-DD" size="small" />
          </Form.Item>
        </Space>

        <Divider orientation="left" style={{ margin: '8px 0', fontSize: '12px', color: '#8c8c8c' }}>
          {t('workflow.list.updatedAt')}
        </Divider>
        <Space block direction="horizontal" style={{ width: '100%' }}>
          <Form.Item
            label={t('workflow.designer.editStartTime')}
            name={[field.name, 'updatedAtStart']}
            style={{ marginBottom: 0, flex: 1 }}
          >
            <Input placeholder="YYYY-MM-DD" size="small" />
          </Form.Item>
          <Form.Item
            label={t('workflow.designer.editEndTime')}
            name={[field.name, 'updatedAtEnd']}
            style={{ marginBottom: 0, flex: 1 }}
          >
            <Input placeholder="YYYY-MM-DD" size="small" />
          </Form.Item>
        </Space>
      </div>
    </Card>
  );
};

const FetchResourceProperties = ({ node, setNodes, currentNodeId }) => {
  const { t } = useTranslation();
  const { appId } = useParams();
  const VariableInput = PROPERTY_INPUTS_REGISTRY.variableInput;

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <Form.Item label="Search Query" name="query">
        <VariableInput
          currentNodeId={currentNodeId || node?.id}
          placeholder="e.g. {{trigger.keyword}}"
        />
      </Form.Item>
      <SchemaConfigList
        mode="input"
        label="Query Parameters"
        node={node}
        setNodes={setNodes}
        currentNodeId={currentNodeId || node?.id}
      />
      <Form.List
        name="groups"
        initialValue={node.data.groups || [{ type: 'all', _confirmed: false }]}
      >
        {(fields, { add, remove }) => (
          <>
            {fields.map((field) => (
              <FilterGroup
                key={field.key}
                field={field}
                remove={remove}
                currentNodeId={currentNodeId || node?.id}
                appId={appId}
                t={t}
                node={node}
                setNodes={setNodes}
              />
            ))}
            <Button
              type="dashed"
              onClick={() => add({ type: 'all', _confirmed: false })}
              block
              icon={<PlusOutlined />}
              style={{ borderRadius: '8px', marginTop: 8 }}
            >
              {t('workflow.designer.addFilterGroup')}
            </Button>
          </>
        )}
      </Form.List>
    </NodePropertyCollapse>
  );
};

export default FetchResourceProperties;
