import React, { useState } from 'react';
import { Tooltip, Button, Dropdown, Modal, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EllipsisOutlined } from '@ant-design/icons';
import { getResourceIcon } from './utils/resourceIcons';
import GenericTree from '../../components/common/GenericTree';
import DocumentImportModal from '../document-import/components/DocumentImportModal';
import { usePermission } from '../../hooks/usePermission';
import { APP_PERMISSIONS } from '../../constants/permissions.js';

export default function ResourceTree({
  nodes = [],
  onRefreshNode,
  onSelect,
  onCreate,
  getCreateMenu,
  onDelete,
  onSettings,
  selectedKey,
  expandedKeys = [],
  onExpand,
  allowCreate = true,
  loadingKeys,
  onMove,
}) {
  const { t } = useTranslation();
  const { hasAppPermission } = usePermission();
  const [uploadModal, setUploadModal] = useState({ visible: false, node: null });

  const renderIcon = (node, { isExpanded } = {}) => {
    const d = node.data || {};
    const isContainer = !node.isLeaf;

    const loadingSet = loadingKeys instanceof Set ? loadingKeys : null;
    const isLoading = loadingSet
      ? loadingSet.has(node.key)
      : Array.isArray(loadingKeys)
        ? loadingKeys.includes(node.key)
        : false;

    if (isLoading) return <Spin size="small" />;

    return getResourceIcon(d.type, {
      isExpanded,
      isContainer,
      isSkill: d.meta?.isSkill || false,
      isKnowledge: d.meta?.isKnowledge || d.meta?.purpose === 'KNOWLEDGE' || false,
    });
  };

  const renderTitle = (node) => {
    const rawTitle = node.title;
    const displayTitle =
      rawTitle === null || rawTitle === undefined || rawTitle === '' ? '无标题' : String(rawTitle);
    return displayTitle;
  };

  const renderActions = (node) => {
    // const canManageDocs = hasAppPermission(APP_PERMISSIONS.DOC_MANAGE);
    const canManageDocs = true;

    const d = node.data || {};
    const isDoc = d.type === 'document';
    const isFolder = d.type === 'folder';
    const isPdf = d.type === 'pdf';
    const isVideo = d.type === 'video' || d.type === 'mp4';
    const isAudio = d.type === 'audio' || d.type === 'mp3';
    const isMedia = isVideo || isAudio;
    const isDeletable = true;
    const isContainer = isFolder || !node.isLeaf;
    const containerAllows = d.allowCreate !== false;
    const canCreateHere = canManageDocs && containerAllows && (isDoc || isFolder);

    const dropdownItems = [];
    if (isDeletable && canManageDocs) {
      if (isContainer) {
        dropdownItems.push({
          key: 'settings',
          label: '设置',
        });
      }
      if (isDoc || isFolder) {
        dropdownItems.push({
          key: 'upload',
          label: '上传',
        });
      }
      dropdownItems.push({
        key: 'delete',
        label: '删除',
        danger: true,
      });
    }

    return (
      <>
        {dropdownItems.length > 0 && (
          <Dropdown
            trigger={['click']}
            menu={{
              items: dropdownItems,
              onClick: ({ key, domEvent }) => {
                if (domEvent) {
                  domEvent.stopPropagation();
                  domEvent.preventDefault();
                }
                if (key === 'settings' && (isDoc || isFolder)) {
                  onSettings && onSettings(node);
                  return;
                }
                if (key === 'upload' && (isDoc || isFolder)) {
                  setUploadModal({ visible: true, node });
                  return;
                }
                if (key === 'delete' && isDeletable) {
                  Modal.confirm({
                    title: isFolder
                      ? '删除文件夹'
                      : isPdf
                        ? '删除文件'
                        : isMedia
                          ? '删除媒体文件'
                          : t('resourceTree.deleteTitle') || '删除笔记',
                    content: isFolder
                      ? '确定要删除该文件夹吗？此操作不可恢复（需先删除其子项）。'
                      : isPdf || isMedia
                        ? '确定要删除该文件吗？此操作不可恢复。'
                        : t('resourceTree.deleteContent') ||
                          '确定要删除该笔记吗？此操作不可恢复（需先删除其子笔记）。',
                    okText: t('common.delete') || '删除',
                    okButtonProps: { danger: true },
                    cancelText: t('common.cancel') || '取消',
                    onOk: () => {
                      if (onDelete) {
                        // Use both IDs for context
                        onDelete(d.refId || d._id, node);
                      }
                      Modal.destroyAll();
                    },
                    onCancel: (e) => {
                      e?.stopPropagation?.();
                      Modal.destroyAll();
                    },
                  });
                }
              },
            }}
          >
            <span onClick={(e) => e.stopPropagation()}>
              <Tooltip title="更多">
                <Button
                  type="text"
                  size="small"
                  className="gt-action-btn"
                  icon={<EllipsisOutlined />}
                />
              </Tooltip>
            </span>
          </Dropdown>
        )}
        {canCreateHere && (
          <Tooltip title="新建笔记">
            <span onClick={(e) => e.stopPropagation()}>
              {(() => {
                const menu = getCreateMenu ? getCreateMenu(node) : null;
                if (menu) {
                  return (
                    <Dropdown trigger={['click']} menu={menu} placement="bottomRight">
                      <Button
                        type="text"
                        size="small"
                        className="gt-action-btn"
                        icon={<PlusOutlined />}
                      />
                    </Dropdown>
                  );
                }
                return (
                  <Button
                    type="text"
                    size="small"
                    className="gt-action-btn"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      if (onCreate) {
                        onCreate(node || {});
                      }
                    }}
                  />
                );
              })()}
            </span>
          </Tooltip>
        )}
      </>
    );
  };

  const handleDrop = (info) => {
    const { dropToGap, node, dragNode, dropPosition } = info;
    const dragData = dragNode.data || {};
    const dropData = node.data || {};

    const nodeId = dragData.id;
    if (!nodeId) return;

    let newParentId = null;
    let newOrder = 0;

    if (!dropToGap) {
      // Drop ONTO a node -> Nesting
      // Only docs and folders can accept children
      if (dropData.type !== 'document' && dropData.type !== 'folder') return;
      newParentId = dropData.id;
      newOrder = 0; // Insert at the beginning of children
    } else {
      // Drop into a GAP -> Reordering (Sibling)
      newParentId = dropData.parentId || null;

      // Calculate order based on dropPosition
      const nodeIndex = dropPosition;
      newOrder = nodeIndex;

      // Special check: if we are dragging something from above
      // of target into its position, the target index shifts.
      // But standard business logic usually handles this.
      // 0 is usually root if dropPosition is absolute.
    }

    if (onMove) {
      onMove({ nodeId, newParentId, newOrder: Math.max(0, newOrder) });
    }
  };

  return (
    <>
      <GenericTree
        treeData={nodes}
        draggable
        selectedKeys={selectedKey ? [selectedKey] : []}
        expandedKeys={expandedKeys}
        onSelect={(keys, info) => onSelect && onSelect(keys && keys[0], info)}
        onExpand={onExpand}
        renderIcon={renderIcon}
        renderTitle={renderTitle}
        renderActions={renderActions}
        treeProps={{
          onDrop: handleDrop,
          allowDrop: () => true,
        }}
      />
      <DocumentImportModal
        visible={uploadModal.visible}
        node={uploadModal.node}
        onCancel={() => setUploadModal({ visible: false, node: null })}
        onSuccess={async (createdDoc) => {
          setUploadModal({ visible: false, node: null });
          if (onRefreshNode && uploadModal.node) {
            try {
              await onRefreshNode(uploadModal.node, createdDoc);
            } catch (e) {
              /* ignore */
            }
          }
        }}
      />
    </>
  );
}
