import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { getPlugins } from '../../../api/plugins';
import { NODE_ICONS } from '../constants';

export const WorkflowContext = createContext(null);

export const WorkflowProvider = ({ appId, children, nodeRegistry = {} }) => {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [pluginStatuses, setPluginStatuses] = useState({});

  useEffect(() => {
    const loadPlugins = async () => {
      if (!appId) return;
      setLoading(true);
      try {
        const data = await getPlugins();
        setPlugins(data || []);
      } catch (err) {
        console.error('Failed to load workflow plugins', err);
      } finally {
        setLoading(false);
      }
    };
    loadPlugins();
  }, [appId]);

  // 辅助函数：根据节点实例精准获取其背后的原始配置/元数据
  const getNodeConfig = useCallback(
    (node) => {
      if (!node) return null;

      // 1. 如果是插件节点，通过 pluginId 在 plugins 列表里找
      if (['plugin-action', 'plugin-trigger'].includes(node.type)) {
        const pluginId = node.data?.pluginId;
        const plugin = plugins.find((p) => p.id === pluginId);
        if (plugin) {
          return {
            ...plugin, // 插件元数据 (包含 isAddon, category 等)
            ...nodeRegistry[node.type], // 基础组件定义 (确保 node 和 properties 组件不被覆盖)
            label: plugin.name || nodeRegistry[node.type]?.label,
          };
        }
      }

      // 2. 普通节点，直接从静态注册表拿
      return nodeRegistry[node.type];
    },
    [nodeRegistry, plugins],
  );

  const getNodeLabel = useCallback(
    (node) => {
      if (!node) return '';
      // 1. 优先使用用户手动修改的名字
      if (node.data?.label) return node.data.label;

      // 2. 获取配置
      const config = getNodeConfig(node);
      const labelKey = config?.label || config?.name;
      if (!labelKey) return t('workflow.nodes.unnamed', 'Unnamed Node');

      // 3. 尝试翻译（如果看起来像 Key 的话）
      if (typeof labelKey === 'string' && labelKey.includes('.')) {
        const translated = t(labelKey);
        if (translated && translated !== labelKey) return translated;
      }

      // 4. 最后回退到原始 label 或 name (通常是插件名或硬编码的名字)
      return labelKey || t('workflow.nodes.unnamed', 'Unnamed Node');
    },
    [getNodeConfig, t],
  );

  // 统一的分类逻辑
  const categories = useMemo(() => {
    const getRegistryNode = (type) => {
      const config = nodeRegistry[type];
      if (!config) return null;

      let label = config.label || type;
      if (typeof label === 'string' && label.includes('.')) {
        const translated = t(label);
        if (translated && translated !== label) label = translated;
      }

      let desc = config.desc || '';
      if (typeof desc === 'string' && desc.includes('.')) {
        const translated = t(desc);
        if (translated && translated !== desc) desc = translated;
      }

      return {
        type,
        label,
        icon: NODE_ICONS[type],
        desc,
      };
    };

    const baseCategories = [
      {
        key: 'trigger',
        name: t('workflow.categories.trigger', '触发源 (Trigger)'),
        nodes: [
          getRegistryNode('click'),
          getRegistryNode('webhook'),
          getRegistryNode('schedule'),
          getRegistryNode('dataChange'),
          getRegistryNode('capability'),
          getRegistryNode('end'),
        ].filter(Boolean),
      },
      {
        key: 'aiAgent',
        name: t('workflow.categories.ai', 'AI 核心 (Brain)'),
        nodes: [
          getRegistryNode('aiAgent'),
          getRegistryNode('skillNode'),
          getRegistryNode('recallKnowledge'),
          getRegistryNode('fetchMemory'),
          getRegistryNode('loadMemory'),
        ].filter(Boolean),
      },
      {
        key: 'variables',
        name: t('workflow.categories.variables', '个人云变量 (Variables)'),
        nodes: [].filter(Boolean),
      },
      {
        key: 'logic',
        name: t('workflow.categories.logic', '逻辑流程 (Flow)'),
        nodes: [
          getRegistryNode('if'),
          getRegistryNode('while'),
          getRegistryNode('for'),
          getRegistryNode('waitUpdate'),
        ].filter(Boolean),
      },
      {
        key: 'tool',
        name: t('workflow.categories.tool', '工具与通知 (Tools)'),
        nodes: [
          getRegistryNode('dingTalkRobot'),
          getRegistryNode('notification'),
          getRegistryNode('log'),
          getRegistryNode('skillAction'),
        ].filter(Boolean),
      },
      {
        key: 'resource',
        name: t('workflow.categories.resource', '数据支撑 (Data)'),
        nodes: [
          getRegistryNode('curl'),
          getRegistryNode('fetchResource'),
          getRegistryNode('vectorSearch'),
          getRegistryNode('vectorIndex'),
        ].filter(Boolean),
      },
      {
        key: 'conversation',
        name: t('workflow.categories.chat', '对话能力 (Chat)'),
        nodes: [
          getRegistryNode('addMessage'),
          getRegistryNode('queryMemory'),
          getRegistryNode('fetchMemory'),
          getRegistryNode('recallKnowledge'),
        ].filter(Boolean),
      },
    ];

    const mapPluginToNode = (p) => ({
      type: p.type === 'trigger' ? 'plugin-trigger' : 'plugin-action',
      pluginId: p.id,
      label: p.name,
      icon: p.icon,
      desc: p.description,
      isPlugin: true,
      isAddon: p.isAddon,
      category: p.category,
      iconColor: p.iconColor,
      allowedSlots: p.allowedSlots,
      // 💡 重点：这里提前准备好初始数据，包含插件定义的输出
      initialData: {
        pluginId: p.id,
        outputs: Array.isArray(p.outputs)
          ? p.outputs
          : Object.entries(p.outputs || {}).map(([name, def]) => ({ name, ...def })),
      },
    });

    const assignedPluginIds = new Set();
    const merged = baseCategories.map((cat) => {
      const matchedPlugins = plugins.filter((p) => {
        const isTriggerPlugin = p.isTrigger || p.type === 'trigger';
        if (cat.key === 'trigger' && isTriggerPlugin) return true;
        // 允许通过 category 字符串匹配
        return !isTriggerPlugin && p.category?.toLowerCase() === cat.key.toLowerCase();
      });
      matchedPlugins.forEach((p) => assignedPluginIds.add(p.id));
      return {
        ...cat,
        nodes: [...cat.nodes, ...matchedPlugins.map(mapPluginToNode)],
      };
    });

    const unassignedPlugins = plugins.filter((p) => !assignedPluginIds.has(p.id));
    if (unassignedPlugins.length > 0) {
      merged.push({
        key: 'plugins',
        name: t('workflow.categories.plugins', '其它插件 (Extensions)'),
        nodes: unassignedPlugins.map(mapPluginToNode),
      });
    }

    return merged;
  }, [nodeRegistry, plugins, t]);

  const getNodeTypes = useCallback(
    (handleSettingsOpen) => {
      const nodeTypes = {};
      Object.keys(nodeRegistry).forEach((type) => {
        const { node: NodeComponent } = nodeRegistry[type];
        if (!NodeComponent) return;
        nodeTypes[type] = (props) => (
          <NodeComponent {...props} onOpenSettings={handleSettingsOpen} />
        );
      });
      return nodeTypes;
    },
    [nodeRegistry],
  );

  const value = useMemo(
    () => ({
      fullRegistry: nodeRegistry,
      getNodeConfig,
      categories,
      getNodeLabel,
      getNodeTypes,
      plugins,
      loading,
      nodes,
      setNodes,
      onNodesChange,
      edges,
      setEdges,
      onEdgesChange,
      pluginStatuses,
      setPluginStatuses,
    }),
    [
      nodeRegistry,
      getNodeConfig,
      categories,
      getNodeLabel,
      getNodeTypes,
      plugins,
      loading,
      nodes,
      setNodes,
      onNodesChange,
      edges,
      setEdges,
      onEdgesChange,
      pluginStatuses,
      setPluginStatuses,
    ],
  );

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
};

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  // 如果在 Context 之外使用，返回一个基础的兜底对象，防止应用崩溃
  if (!context) {
    return {
      fullRegistry: {},
      getNodeConfig: () => ({}),
      categories: [],
      getNodeLabel: (node) => node?.data?.label || node?.type || node?.id || '',
      getNodeTypes: () => ({}),
      plugins: [],
      loading: false,
    };
  }
  return context;
};
