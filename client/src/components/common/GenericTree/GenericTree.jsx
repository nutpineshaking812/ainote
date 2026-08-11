import React, { useState, useEffect } from 'react';
import { Tree, Tooltip, Button, Dropdown, theme } from 'antd';
import {
  FolderOutlined,
  FileOutlined,
  EllipsisOutlined,
  PlusOutlined,
  DeleteOutlined,
  CaretRightOutlined,
} from '@ant-design/icons';
import { handleTreeDrop } from './utils';
import './GenericTree.css';

const { useToken } = theme;

/**
 * GenericTree Component
 *
 * @param {Object[]} treeData - The hierarchical data to display. Each node object should satisfy:
 *    @property {string|number} key - Unique identifier (configurable via keyField).
 *    @property {string} title - Display title (configurable via renderTitle).
 *    @property {Object[]} [children] - Nested child nodes (configurable via childrenField).
 *    @property {boolean} [isLeaf] - If true, the node is treated as a leaf and cannot be expanded.
 * @param {Function} [onDataChange] - (newData, info) => void. Called when tree data changes (e.g. after drag-drop).
 * @param {Function} [onSelect] - (selectedKeys, info) => void. Called when a node is selected.
 * @param {Function} [onExpand] - (expandedKeys, info) => void. Called when a node is expanded/collapsed.
 * @param {string[]} [selectedKeys] - Controlled selected keys.
 * @param {string[]} [expandedKeys] - Controlled expanded keys.
 * @param {boolean} [draggable=false] - Whether the tree supports drag-and-drop.
 * @param {Function} [renderTitle] - (node) => ReactNode. Custom title renderer.
 * @param {Function} [renderIcon] - (node) => ReactNode. Custom icon renderer.
 * @param {Function} [renderActions] - (node) => ReactNode. Custom actions renderer (shown on hover).
 * @param {Object} [treeProps] - Pass-through props for the underlying Ant Design Tree component.
 * @param {string} [keyField='key'] - Field name for the unique identifier.
 * @param {string} [childrenField='children'] - Field name for child nodes.
 */
const GenericTree = ({
  treeData = [],
  onDataChange,
  onSelect,
  onExpand,
  selectedKeys: propsSelectedKeys,
  expandedKeys: propsExpandedKeys,
  draggable = false,
  renderTitle,
  renderIcon,
  renderActions,
  treeProps = {},
  keyField = 'key',
  childrenField = 'children',
}) => {
  const [internalExpandedKeys, setInternalExpandedKeys] = useState([]);
  const [internalSelectedKeys, setInternalSelectedKeys] = useState([]);

  // Use props if provided, otherwise use internal state
  const expandedKeys = propsExpandedKeys !== undefined ? propsExpandedKeys : internalExpandedKeys;
  const selectedKeys = propsSelectedKeys !== undefined ? propsSelectedKeys : internalSelectedKeys;

  const handleExpand = (keys, info) => {
    if (propsExpandedKeys === undefined) {
      setInternalExpandedKeys(keys);
    }
    if (onExpand) {
      onExpand(keys, info);
    }
  };

  const handleSelect = (keys, info) => {
    if (propsSelectedKeys === undefined) {
      setInternalSelectedKeys(keys);
    }
    if (onSelect) {
      onSelect(keys, info);
    }
  };

  const handleDrop = (info) => {
    if (!onDataChange) return;

    const newData = handleTreeDrop(info, treeData, { keyField, childrenField });
    onDataChange(newData, info);
  };

  const defaultRenderIcon = (node) => {
    if (node[childrenField] && node[childrenField].length >= 0) {
      return <FolderOutlined />;
    }
    return <FileOutlined />;
  };

  const defaultRenderTitle = (node) => {
    return node.title || node.name || 'Untitled';
  };

  const titleRender = (node) => {
    const isExpanded = expandedKeys.includes(node[keyField]);
    const icon = renderIcon ? renderIcon(node, { isExpanded }) : defaultRenderIcon(node);
    const title = renderTitle ? renderTitle(node, { isExpanded }) : defaultRenderTitle(node);
    const actions = renderActions ? renderActions(node) : null;
    const hasChildren = !node.isLeaf || (node[childrenField] && node[childrenField].length > 0);

    const handleSwitcherClick = (e) => {
      e.stopPropagation();
      const nextKeys = isExpanded
        ? expandedKeys.filter((k) => k !== node[keyField])
        : [...expandedKeys, node[keyField]];
      handleExpand(nextKeys, { expanded: !isExpanded, node });
    };

    return (
      <div className="gt-node-row">
        <div className="gt-node-main">
          <div className="gt-icon-wrapper">
            {hasChildren ? (
              <>
                <span 
                  className={`gt-switcher hover-icon ${isExpanded ? 'expanded' : ''}`}
                  onClick={handleSwitcherClick}
                >
                  <CaretRightOutlined />
                </span>
                <span className="gt-node-icon default-icon">{icon}</span>
              </>
            ) : (
              <span className="gt-node-icon">{icon}</span>
            )}
          </div>
          <div className="gt-node-content">
            <span className="gt-node-title" title={typeof title === 'string' ? title : ''}>
              {title}
            </span>
          </div>
        </div>
        {actions && <div className="gt-node-actions">{actions}</div>}
      </div>
    );
  };

  const { token } = useToken();

  const themeVars = {
    '--gt-token-primary': token.colorPrimary,
    '--gt-token-text': token.colorText,
    '--gt-token-text-secondary': token.colorTextSecondary,
    '--gt-token-text-description': token.colorTextDescription,
    '--gt-token-bg-hover': token.colorFillTertiary || token.controlItemBgHover,
    '--gt-token-bg-selected': token.controlItemBgActive,
  };

  return (
    <div className="generic-tree-container" style={themeVars}>
      <Tree
        className="generic-tree"
        draggable={draggable ? { icon: false } : false}
        blockNode
        treeData={treeData}
        selectedKeys={selectedKeys}
        expandedKeys={expandedKeys}
        onSelect={handleSelect}
        onExpand={handleExpand}
        onDrop={draggable ? handleDrop : undefined}
        titleRender={titleRender}
        {...treeProps}
      />
    </div>
  );
};

export default GenericTree;
export { handleTreeDrop };
