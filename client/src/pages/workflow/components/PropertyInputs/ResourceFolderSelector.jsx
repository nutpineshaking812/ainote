import React, { useState, useEffect, useRef } from 'react';
import { TreeSelect, Button, Tooltip, Space } from 'antd';
import { getResources } from '../../../../api/resources';
import {
  FolderOutlined,
  FileOutlined,
  FileTextOutlined,
  EditOutlined,
  UnorderedListOutlined,
  FolderFilled,
  FolderOpenFilled,
  ReadOutlined,
  FilePdfOutlined,
  FormOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import VariableInput from './VariableInput';

const { SHOW_PARENT } = TreeSelect;

/**
 * ResourceFolderSelector - A TreeSelect component for choosing a folder/document from the resource tree.
 * Now supports switching between Select mode and Variable Input mode.
 */
const ResourceFolderSelector = ({
  appId: propsAppId,
  value,
  parentName,
  onChange,
  placeholder,
  style,
  nodes = [],
  currentNodeId,
  ...rest
}) => {
  const { t } = useTranslation();
  const { appId: routeAppId } = useParams();
  const appId = propsAppId || routeAppId;

  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);

  const isVariable = (val) => typeof val === 'string' && val.includes('{{');
  const [inputMode, setInputMode] = useState(() => (isVariable(value) ? 'input' : 'select'));
  const hasManuallyToggled = useRef(false);

  useEffect(() => {
    if (!hasManuallyToggled.current) {
      const targetMode = isVariable(value) ? 'input' : 'select';
      if (targetMode !== inputMode) {
        setInputMode(targetMode);
      }
    }
  }, [value, inputMode]);

  const mapToTreeData = (items) => {
    return items
      .filter((item) => ['folder', 'document'].includes(item.type))
      .map((item) => {
        const isContainer = !item.isLeaf;
        const iconStyle = { fontSize: '14px' };

        let icon;
        switch (item.type) {
          case 'folder':
            icon = <FolderFilled style={{ ...iconStyle, color: '#faad14' }} />;
            break;
          case 'document':
            icon = isContainer ? (
              <FolderOutlined style={{ ...iconStyle, color: '#91918e' }} />
            ) : (
              <FileOutlined style={{ ...iconStyle, color: '#91918e' }} />
            );
            break;
          case 'form':
            icon = <FormOutlined style={{ ...iconStyle, color: '#91918e' }} />;
            break;
          case 'view':
            icon = <AppstoreOutlined style={{ ...iconStyle, color: '#91918e' }} />;
            break;
          default:
            icon = isContainer ? (
              <FolderOutlined style={{ ...iconStyle, color: '#91918e' }} />
            ) : (
              <FileOutlined style={{ ...iconStyle, color: '#91918e' }} />
            );
        }

        return {
          id: item.id,
          pId: item.parentId || null,
          value: item.id,
          title: item.meta?.name || item.name || 'Untitled',
          label: item.meta?.name || item.name || 'Untitled',
          isLeaf: item.isLeaf === true,
          icon: icon,
        };
      });
  };

  const fetchRoot = async () => {
    if (!appId || inputMode !== 'select') return;

    // If we already have data and the current value is in it, don't reset everything
    // but we might need to refresh roots occasionally.
    // For now, let's just ensure we don't clear children if we don't have to.

    setLoading(true);
    try {
      const items = await getResources(appId, {});
      const roots = mapToTreeData(items || []);

      setTreeData((origin) => {
        // Create a map of existing nodes to preserve them (especially children)
        const nodeMap = new Map();
        origin.forEach((node) => nodeMap.set(node.id, node));

        // Overwrite/Add roots
        roots.forEach((root) => nodeMap.set(root.id, root));

        // Ensure current selected value is in the map if it has a label
        if (value && parentName && !nodeMap.has(value)) {
          nodeMap.set(value, {
            id: value,
            value: value,
            title: parentName,
            label: parentName,
            isLeaf: false,
            pId: null,
            icon: <FolderOutlined style={{ color: '#faad14' }} />,
          });
        }

        return Array.from(nodeMap.values());
      });
    } catch (err) {
      console.error('Failed to load folders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTreeData([]); // Clear tree when appId changes
    fetchRoot();
  }, [appId, inputMode]);

  const onLoadData = async ({ id }) => {
    try {
      const items = await getResources(appId, { parentId: id });
      const children = mapToTreeData(items || []);

      setTreeData((origin) => {
        // Only add children that aren't already in the tree
        const existingIds = new Set(origin.map((item) => item.id));
        const newChildren = children.filter((c) => !existingIds.has(c.id));
        return origin.concat(newChildren.map((c) => ({ ...c, pId: id })));
      });
    } catch (err) {
      console.error('Failed to load sub-folders', err);
    }
  };

  const handleToggle = () => {
    hasManuallyToggled.current = true;
    setInputMode((prev) => (prev === 'select' ? 'input' : 'select'));
  };

  return (
    <div style={{ display: 'flex', gap: 4, width: '100%', ...style }}>
      <div style={{ flex: 1 }}>
        {inputMode === 'select' ? (
          <TreeSelect
            style={{ width: '100%' }}
            value={isVariable(value) ? undefined : value}
            dropdownStyle={{
              maxHeight: 400,
              overflow: 'auto',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            placeholder={
              placeholder || t('workflow.designer.selectParentFolder', 'Select Parent Folder...')
            }
            allowClear
            treeDefaultExpandAll={false}
            treeLine={{ showLeafIcon: false }}
            treeDataSimpleMode
            onChange={onChange}
            loadData={onLoadData}
            treeData={treeData}
            loading={loading}
            treeIcon
            showSearch
            variant="outlined"
            filterTreeNode={(inputValue, treeNode) =>
              (treeNode.title || '').toLowerCase().includes(inputValue.toLowerCase())
            }
            {...rest}
          />
        ) : (
          <VariableInput
            value={value}
            onChange={onChange}
            nodes={nodes}
            currentNodeId={currentNodeId}
            placeholder={placeholder || t('workflow.designer.enterFolderId', 'Enter Folder ID...')}
            mode="preview"
            style={{ width: '100%' }}
            {...rest}
          />
        )}
      </div>
      <Tooltip
        title={
          inputMode === 'select'
            ? t('common.switchToVariable', 'Switch to Variable')
            : t('common.switchToSelect', 'Switch to Selection')
        }
      >
        <Button
          icon={inputMode === 'select' ? <EditOutlined /> : <UnorderedListOutlined />}
          onClick={handleToggle}
        />
      </Tooltip>
    </div>
  );
};

export default ResourceFolderSelector;
