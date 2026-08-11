import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Modal, Spin, Empty, Typography, Space } from 'antd';
const { Text } = Typography;
import { useTranslation } from 'react-i18next';
import { getResourceIcon } from '../../../features/resource-tree/utils/resourceIcons';
// 引入核心缓存 Hook 和 树形构建工具
import { useResourceCache } from '../../../lib/resource-cache/hooks/useResourceCache';
import { buildResourceTree } from '../../../lib/resource-cache/utils/treeBuilder';
// 使用 GenericTree 作为底座
import GenericTree from '../../../components/common/GenericTree';

/**
 * 资源选取器弹窗
 * 重构逻辑：
 * 1. 结构调研：复用 GenericTree 底座，实现与侧边栏一致的异步刷新逻辑
 * 2. 增量获取：利用 loadData 实现展开节点时的增量同步（持久化到 SQLite）
 * 3. 视觉复刻：本地实现图标渲染逻辑，确保与侧边栏 ResourceTree 体验一致
 */
const ResourceSelectorModal = ({ visible, onCancel, onOk, appId, excludeIds = [] }) => {
  const { t } = useTranslation();

  // 1. 获取资源缓存 Hook (获取数据、加载状态和刷新方法)
  const { resources, isLoading, isSyncing, refresh } = useResourceCache(visible ? appId : null);

  // 2. 弹窗打开时，触发一次根节点同步
  useEffect(() => {
    if (visible && appId) {
      refresh(); // 不传参数即同步根目录
    }
  }, [visible, appId, refresh]);

  const [checkedKeys, setCheckedKeys] = useState({ checked: [], halfChecked: [] });
  const [expandedKeys, setExpandedKeys] = useState([]);

  // 3. 过滤并构建树形结构 (保留笔记、表单和文件夹)
  const treeData = useMemo(() => {
    if (!resources || resources.length === 0) return [];

    const filtered = resources.filter(
      (r) =>
        (r.type === 'document' || r.type === 'form' || r.type === 'folder') &&
        !(r.meta?.categoryKeys || []).includes('ai_memory'),
    );

    try {
      return buildResourceTree(filtered);
    } catch (err) {
      console.error('[ResourceSelectorModal] Failed to build tree:', err);
      return [];
    }
  }, [resources]);

  // 4. 异步增量刷新逻辑 (Load on Demand)
  // 当用户展开文件夹时，触发针对该文件夹的增量同步并持久化到本地
  const handleLoadData = useCallback(
    async (node) => {
      const nodeId = node.data?.id;
      if (nodeId && !node.isLeaf) {
        try {
          await refresh(nodeId);
        } catch (err) {
          console.warn('[ResourceSelectorModal] Incremental sync failed', err);
        }
      }
    },
    [refresh],
  );

  // 5. 视觉渲染逻辑 (复刻自 ResourceTree)
  const renderIcon = (node, { isExpanded } = {}) => {
    const d = node.data || {};
    const isContainer = !node.isLeaf;
    return getResourceIcon(d.type, {
      isExpanded,
      isContainer,
      isSkill: d.meta?.isSkill || false,
      isKnowledge: d.meta?.isKnowledge || d.meta?.purpose === 'KNOWLEDGE' || false,
    });
  };

  const renderTitle = (node) => {
    // 关键修复：excludeIds 传入的是原始 UUID，应与 node.data.id 比较
    const isExcluded = excludeIds.includes(node.data?.id);
    return (
      <Space>
        <span
          style={{
            color: isExcluded ? '#ccc' : 'inherit',
            textDecoration: isExcluded ? 'line-through' : 'none',
          }}
        >
          {node.title || '无标题'}
        </span>
        {isExcluded && (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ({t('knowledgeSet.alreadyAdded') || '已加入'})
          </Text>
        )}
      </Space>
    );
  };

  const handleConfirm = () => {
    // 关键修复：前端树节点的 Key 是 ${type}-${refId} 格式
    // 但后端数据库 knowledge_set_items.resource_id 需要的是 app_resources.id (UUID)
    const selectedKeysList = checkedKeys?.checked || [];
    
    const selectedIds = resources
      .filter(r => selectedKeysList.includes(`${r.type}-${r.refId}`))
      .map(r => r.id);

    onOk(selectedIds);
    setCheckedKeys({ checked: [], halfChecked: [] });
  };

  const handleCancel = () => {
    setCheckedKeys({ checked: [], halfChecked: [] });
    onCancel();
  };

  return (
    <Modal
      title={t('knowledgeSet.selector.title')}
      open={visible}
      onCancel={handleCancel}
      onOk={handleConfirm}
      width={600}
      okButtonProps={{
        disabled: !checkedKeys.checked || checkedKeys.checked.length === 0,
      }}
      okText={t('knowledgeSet.selector.addSelected', {
        count: checkedKeys.checked?.length || 0,
      })}
      cancelText={t('common.cancel')}
      bodyStyle={{ padding: '12px 24px' }}
    >
      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {isSyncing && !isLoading && (
          <Space size="small">
            <Spin size="small" />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {t('common.syncing')}
            </Text>
          </Space>
        )}
      </div>

      <div
        style={{
          minHeight: 400,
          maxHeight: 500,
          overflowY: 'auto',
          padding: '12px',
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          background: '#fafafa',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '100px 0', textAlign: 'center' }}>
            <Spin tip={t('common.loading')} />
          </div>
        ) : treeData.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('knowledgeSet.selector.noResources')}
          />
        ) : (
          <GenericTree
            treeData={treeData}
            renderIcon={renderIcon}
            renderTitle={renderTitle}
            expandedKeys={expandedKeys}
            onExpand={setExpandedKeys}
            treeProps={{
              checkable: true,
              checkStrictly: true,
              checkedKeys: checkedKeys,
              onCheck: (keys) => setCheckedKeys(keys),
              loadData: handleLoadData,
              selectable: false,
            }}
          />
        )}
      </div>
    </Modal>
  );
};

export default ResourceSelectorModal;
