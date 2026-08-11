import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { fetchEventSource } from '../../utils/sse';
import dayjs from 'dayjs';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Panel,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import {
  Button,
  Layout,
  Space,
  Typography,
  message,
  Form,
  Input,
  Select,
  Tabs,
  Tooltip,
  Empty,
  Badge,
  Divider,
  Tag,
  Card,
  Splitter,
  Radio,
  TimePicker,
  Modal,
  Row,
  Col,
  Switch,
  Drawer,
  Upload,
  Spin,
  Skeleton,
} from 'antd';
import {
  SaveOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  FullscreenOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  HistoryOutlined,
  SendOutlined,
  BarsOutlined,
  DeleteOutlined,
  CopyOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  BugOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  ExperimentOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  ApartmentOutlined,
  ImportOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { WorkflowProvider, useWorkflow } from './context/WorkflowContext';
import { useParams, useNavigate, useBlocker, useLocation } from 'react-router-dom';
import { AgentDockProvider, AgentDock, AgentWorkspace } from '../../features/chat';
import { EMPLOYEE_SCENARIOS } from '../../constants/employee';
import {
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
  executeWorkflow,
  streamWorkflowExecute,
  debugNode,
  publishWorkflow, // Added
  toggleWorkflowStatus, // Added
  resetWorkflow,
} from '../../api/workflow';
import PublishModal from './components/PublishModal'; // Added
import ParameterEditor from './components/ParameterEditor';
import ResizableDrawer from '../../components/common/ResizableDrawer';
import { useTranslation } from 'react-i18next';
import { NODE_REGISTRY } from './nodes/registry';
import NodeSidebar from './NodeSidebar';
import { getFormsByAppId } from '../../api/forms';
import { NODE_ICONS, STANDARD_SYSTEM_INPUTS } from './constants';
import EditableTitle from '../../components/common/EditableTitle';
import PageHeader from '../../components/PageHeader';
import { generateShortId } from '../../utils/shortId';
const { Content } = Layout;
import { getPluginIcon } from './utils/pluginIcons';
import { getPluginStatus, getPluginMetaSync } from '../../api/plugins';

const { Title } = Typography;

const WorkflowDesignerContent = forwardRef(
  ({ overrideAppId, overrideWorkflowId, hideHeader }, ref) => {
    useImperativeHandle(ref, () => ({
      save: onSave,
    }));
    // Enhanced Edge Styles (injected via style tag)
    const edgeStyles = `
    .react-flow__edge-path {
      transition: stroke 0.2s, stroke-width 0.2s, filter 0.2s;
    }
    .react-flow__edge.selected .react-flow__edge-path {
      stroke: #1890ff !important;
      stroke-width: 3 !important;
      filter: drop-shadow(0 0 5px rgba(24, 144, 255, 0.8));
    }
    .react-flow__edge.selected marker path {
      fill: #1890ff !important;
      transition: fill 0.2s;
    }
    /* Special handling for dashed lines (skills/memory) when selected */
    .react-flow__edge.selected.skill-edge .react-flow__edge-path {
      stroke: #722ed1 !important;
      filter: drop-shadow(0 0 5px rgba(114, 46, 209, 0.8));
    }
    .react-flow__edge.selected.memory-edge .react-flow__edge-path {
      stroke: #52c41a !important;
      filter: drop-shadow(0 0 5px rgba(82, 196, 26, 0.8));
    }
    .react-flow__edge.selected.knowledge-edge .react-flow__edge-path {
      stroke: #fa8c16 !important;
      filter: drop-shadow(0 0 5px rgba(250, 140, 22, 0.8));
    }
    .react-flow__edge.selected.collaborator-edge .react-flow__edge-path {
      stroke: #13c2c2 !important;
      filter: drop-shadow(0 0 5px rgba(19, 194, 194, 0.8));
    }
  `;

    const params = useParams();
    const appId = overrideAppId || params.appId;
    const workflowId = overrideWorkflowId || params.workflowId;
    const navigate = useNavigate();
    const location = useLocation();
    const {
      nodes,
      setNodes,
      onNodesChange: _onNodesChange,
      edges,
      setEdges,
      onEdgesChange: _onEdgesChange,
      getNodeLabel,
      getNodeConfig,
      getNodeTypes,
      loading: metadataLoading,
      pluginStatuses,
      setPluginStatuses,
      fullRegistry,
    } = useWorkflow();

    const onNodesChange = useCallback(
      (changes) => {
        _onNodesChange(changes);
        // Mark as dirty for any relevant change (dimension, position, etc.)
        const isSignificant = changes.some((c) => ['remove', 'position'].includes(c.type));
        if (isSignificant) setIsDirty(true);
      },
      [_onNodesChange],
    );

    const onEdgesChange = useCallback(
      (changes) => {
        _onEdgesChange(changes);
        if (changes.some((c) => ['remove'].includes(c.type))) setIsDirty(true);
      },
      [_onEdgesChange],
    );
    const [workflow, setWorkflow] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [executionLog, setExecutionLog] = useState([]);
    const [activeTab, setActiveTab] = useState('settings');
    const [logOpen, setLogOpen] = useState(false);
    const [menu, setMenu] = useState(null); // { x, y, nodeId, type: 'node' | 'pane' }
    const [debugLoading, setDebugLoading] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [publishModalOpen, setPublishModalOpen] = useState(false); // Added state
    const [aiPanelOpen, setAiPanelOpen] = useState(false);
    const initialDataRef = useRef(null);
    const isDirtyRef = useRef(isDirty);

    useEffect(() => {
      isDirtyRef.current = isDirty;
    }, [isDirty]);
    const [form] = Form.useForm();
    const scheduleMode = Form.useWatch('scheduleMode', form);
    const [forms, setForms] = useState([]);
    const { t } = useTranslation();
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [settingsForm] = Form.useForm();
    const reactFlowWrapper = useRef(null);
    const { screenToFlowPosition, getNode, fitView } = useReactFlow();

    // Navigation Blocker (Protects against Link/useNavigate)
    const blocker = useBlocker(
      ({ currentLocation, nextLocation }) =>
        isDirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
    );

    useEffect(() => {
      if (blocker.state === 'blocked') {
        Modal.confirm({
          title: t('formBuilder.unsavedChangesTitle', 'Unsaved Changes'),
          icon: <ExclamationCircleOutlined color="#faad14" />,
          content: t(
            'formBuilder.unsavedChangesPrompt',
            'You have unsaved changes. Are you sure you want to leave?',
          ),
          okText: t('formBuilder.discardChanges', 'Discard Changes'),
          cancelText: t('formBuilder.continueEditing', 'Continue Editing'),
          onOk: () => blocker.proceed(),
          onCancel: () => blocker.reset(),
        });
      }
    }, [blocker, t]);

    // Window Close/Reload Protection (Browser-level)
    useEffect(() => {
      const handleBeforeUnload = (e) => {
        if (isDirty) {
          e.preventDefault();
          e.returnValue = '';
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Ref to store onSave to avoid keyboard shortcut stale closures
    const saveRef = useRef(null);

    // Mouse position tracking for pasting at cursor
    const mousePositionRef = useRef({ x: 0, y: 0 });
    const handleMouseMove = useCallback((e) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    }, []);

    // Keyboard Shortcut: Cmd+S / Ctrl+S (Save), Cmd+C (Copy), Cmd+V (Paste)
    useEffect(() => {
      const handleKeyDown = (e) => {
        // Robust check to identify if user is currently typing/editing in ANY input field, textarea, contenteditable, or CodeMirror editor.
        const activeEl = document.activeElement;
        const isInputFocused =
          activeEl && (
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) ||
            activeEl.contentEditable === 'true' ||
            activeEl.getAttribute('contenteditable') === 'true' ||
            activeEl.closest('.cm-content') ||
            activeEl.closest('.cm-editor') ||
            activeEl.closest('.monaco-editor')
          );

        // 1. Save: Cmd+S
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
          e.preventDefault();
          if (saveRef.current) saveRef.current();
        }

        // 2. Copy: Cmd+C (only if something is selected and no input is focused)
        if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
          if (isInputFocused) return;

          const selectedNodes = nodes.filter((n) => n.selected);
          if (selectedNodes.length > 0) {
            const triggerTypes = [
              'schedule',
              'webhook',
              'dataChange',
              'click',
              'manual',
              'capability',
              'plugin-trigger',
            ];
            const filterNodes = selectedNodes.filter(n => n.type !== 'end' && !triggerTypes.includes(n.type));
            if (filterNodes.length > 0) {
              // Serialize to localStorage for cross-tab persistence
              localStorage.setItem('workflow_node_clipboard', JSON.stringify(filterNodes));
              message.success(t('common.copied', 'Copied node to clipboard'));
            } else {
              message.warning(t('workflow.designer.cannotCopyTriggerOrEnd', '触发器节点和结束节点不能复制。'));
            }
          }
        }

        // 3. Paste: Cmd+V (only if no input is focused)
        if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
          if (isInputFocused) return;

          const clipboardData = localStorage.getItem('workflow_node_clipboard');
          if (clipboardData) {
            try {
              const copiedNodes = JSON.parse(clipboardData);
              if (!Array.isArray(copiedNodes)) return;

              // Convert screen mouse position to Flow coordinates
              const flowPos = screenToFlowPosition({
                x: mousePositionRef.current.x,
                y: mousePositionRef.current.y,
              });

              // If we copied multiple nodes, we should maintain their relative positions
              // For now, let's assume the first node is at the cursor, and others offset accordingly
              const firstPos = copiedNodes[0].position;

              const newNodes = copiedNodes.map((n, idx) => {
                const relX = n.position.x - firstPos.x;
                const relY = n.position.y - firstPos.y;

                return {
                  ...n,
                  id: generateShortId(
                    nodes.map((nd) => nd.id),
                    4,
                    n.type === 'plugin-trigger'
                      ? 'plt_'
                      : n.type === 'plugin-action'
                        ? 'pla_'
                        : `${n.type}_`,
                  ),
                  position: {
                    x: flowPos.x + relX,
                    y: flowPos.y + relY,
                  },
                  selected: true, // Auto-select the pasted nodes
                };
              });

              // Deselect existing nodes and add new ones
              setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat(newNodes));
              setIsDirty(true);
              message.success(t('common.pasted', 'Pasted nodes from clipboard'));
            } catch (err) {
              console.error('Failed to paste nodes', err);
            }
          }
        }

        // 4. Select All: Cmd+A (only if no input is focused)
        if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
          if (isInputFocused) return;

          e.preventDefault();
          setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
          setEdges((eds) => eds.map((edge) => ({ ...edge, selected: true })));
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('mousemove', handleMouseMove);
      };
    }, [nodes, setNodes, screenToFlowPosition, t]);

    const handleSettingsOpen = useCallback(
      ({ id }) => {
        const node = getNode(id);
        if (node) {
          setSelectedNode(node);

          // Handle schedule specifically for friendly UI
          if (node.type === 'schedule' && node.data.cron) {
            const parts = node.data.cron.split(' ');
            if (parts.length === 5) {
              const [min, hour, day, month, dow] = parts;
              const time = dayjs().hour(parseInt(hour)).minute(parseInt(min));

              if (day === '*' && month === '*' && dow === '*') {
                form.setFieldsValue({ ...node.data, scheduleMode: 'daily', time });
              } else if (dow !== '*') {
                form.setFieldsValue({ ...node.data, scheduleMode: 'weekly', dayOfWeek: dow, time });
              } else if (day !== '*') {
                form.setFieldsValue({
                  ...node.data,
                  scheduleMode: 'monthly',
                  dayOfMonth: day,
                  time,
                });
              } else {
                form.setFieldsValue({ ...node.data, scheduleMode: 'advanced' });
              }
            } else {
              form.setFieldsValue({ ...node.data, scheduleMode: 'advanced' });
            }
          } else {
            form.setFieldsValue(node.data);
          }

          setIsPanelOpen(true);
          setAiPanelOpen(false); // Close AI panel when a node settings panel is opened
        }
      },
      [form, getNode, setAiPanelOpen],
    );

    const handleTestNode = async () => {
      if (!selectedNode) return;

      // Auto-save if dirty before triggering a test
      if (isDirty) {
        const success = await onSave();
        if (!success) return;
      }
      try {
        setDebugLoading(true);

        // Set the node's visual state to 'running' so it displays a spinner on the canvas immediately!
        setNodes((nds) =>
          nds.map((n) =>
            n.id === selectedNode.id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    status: 'running',
                    lastError: null,
                  },
                }
              : n,
          ),
        );
        setSelectedNode((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            status: 'running',
            lastError: null,
          },
        }));

        // Filter out transient metadata like status, lastResult, lastError from config
        const { status, lastResult, lastError, ...cleanConfig } = selectedNode.data;

        const res = await debugNode({
          nodeType: selectedNode.type,
          config: {
            ...cleanConfig,
            appId,
            orgId: workflow?.organizationId,
          },
          context: {}, // Future: allow mock context injection
        });

        message.success(t('workflow.designer.success'));
        const resultData = res.result;

        // Update both the nodes list and the local selectedNode state
        setNodes((nds) =>
          nds.map((n) =>
            n.id === selectedNode.id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    status: 'success',
                    lastResult: resultData,
                    lastError: null,
                  },
                }
              : n,
          ),
        );

        setSelectedNode((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            status: 'success',
            lastResult: resultData,
            lastError: null,
          },
        }));
      } catch (err) {
        console.error('Node Debug Error:', err);
        const errorMsg = err.response?.data?.message || err.message || t('workflow.designer.error');
        message.error(errorMsg);

        // Set the node's visual state to 'error' to avoid getting stuck in a loading status!
        setNodes((nds) =>
          nds.map((n) =>
            n.id === selectedNode.id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    status: 'error',
                    lastError: errorMsg,
                  },
                }
              : n,
          ),
        );
        setSelectedNode((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            status: 'error',
            lastError: errorMsg,
          },
        }));
      } finally {
        setDebugLoading(false);
      }
    };

    // Define node types with settings callback
    const nodeTypes = useMemo(() => getNodeTypes(handleSettingsOpen), [
      getNodeTypes,
      handleSettingsOpen,
    ]);

    // Load forms for this app
    useEffect(() => {
      if (appId) {
        getFormsByAppId(appId)
          .then((res) => {
            setForms(Array.isArray(res) ? res : res.data || []);
          })
          .catch(console.error);
      }
    }, [appId]);

    // Load workflow data
    useEffect(() => {
      if (workflowId === 'new') {
        const triggerId = 'start';
        const endId = 'end';
        const defaultWorkflow = {
          name: 'Untitled Workflow',
          nodes: [
            {
              id: triggerId,
              type: 'click',
              position: { x: 100, y: 150 },
              data: { label: 'Manual Trigger' },
            },
            { id: endId, type: 'end', position: { x: 500, y: 150 }, data: { label: 'End' } },
          ],
          edges: [
            {
              id: `e-${triggerId}-${endId}`,
              source: triggerId,
              target: endId,
              type: 'default',
              animated: true,
            },
          ],
          triggerType: 'MANUAL',
          status: 'INACTIVE',
        };
        setWorkflow(defaultWorkflow);
        setNodes(defaultWorkflow.nodes);
        setEdges(defaultWorkflow.edges);
        return;
      }

      if (workflowId) {
        getWorkflowById(workflowId, { appId }).then((data) => {
          setWorkflow(data);
          setNodes(data.nodes || []);
          const rawEdges = data.edges || [];
          setEdges(
            rawEdges.map((edge) => {
              let className = '';
              if (edge.targetHandle === 'tool-slot') {
                className = 'skill-edge';
              } else if (edge.targetHandle === 'memory-slot') {
                className = 'memory-edge';
              } else if (edge.targetHandle === 'knowledge-slot') {
                className = 'knowledge-edge';
              } else if (edge.targetHandle) {
                // 通用动态解析：从 target 节点的插件属性中解析其 className
                const targetNode = (data.nodes || []).find((n) => n.id === edge.target);
                const targetMeta = targetNode?.data?.pluginId ? getPluginMetaSync(targetNode.data.pluginId) : null;
                const targetSlot = Array.isArray(targetMeta?.slots)
                  ? targetMeta.slots.find((s) => s.id === edge.targetHandle)
                  : null;
                if (targetSlot) {
                  className = targetSlot.className || `${targetSlot.id}-edge`;
                }
              }
              return {
                ...edge,
                type: edge.type || 'default',
                className,
              };
            }),
          );
          settingsForm.setFieldsValue({
            name: location.state?.employeeName ? `${location.state.employeeName} 的逻辑引擎` : data.name,
            description: data.description,
            scope: data.scope || 'APP',
            isSkill: data.isSkill || false,
            skillName: location.state?.employeeName ? `${location.state.employeeName} 的逻辑引擎` : (data.skillConfig?.name || data.name),
            skillDescription: data.skillConfig?.description || '',
            inputSchema: data.skillConfig?.inputSchema || {
              type: 'object',
              properties: {},
              required: [],
            },
            outputSchema: data.skillConfig?.outputSchema || {
              type: 'object',
              properties: {},
              required: [],
            },
          });
        });
      }
    }, [workflowId, appId, setNodes, setEdges]);

    // Plugin Status Polling (Conditional)
    useEffect(() => {
      // 1. Identify trackable keys: Plugin IDs and Node IDs
      // CRITICAL: Only poll if the workflow is ACTIVE.
      if (!workflow || workflow.status !== 'ACTIVE') {
        if (Object.keys(pluginStatuses).length > 0) setPluginStatuses({});
        return;
      }

      const currentPluginIds = nodes
        .filter((n) => ['plugin-action', 'plugin-trigger'].includes(n.type))
        .filter((n) => n.data?.pluginId)
        .map((n) => n.data.pluginId);

      const currentNodeIds = nodes.map((n) => n.id);

      // 合并并去重
      const trackableKeys = Array.from(new Set([...currentPluginIds, ...currentNodeIds]));

      if (trackableKeys.length === 0) {
        if (Object.keys(pluginStatuses).length > 0) setPluginStatuses({});
        return;
      }

      const fetchStatus = async () => {
        try {
          if (workflow?.status !== 'ACTIVE') return;
          const needsPolling = nodes.some((n) => n.data.features?.includes('status_tracking'));
          if (!needsPolling) return;
          const statuses = await getPluginStatus(trackableKeys);
          setPluginStatuses((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(statuses)) return prev;
            return statuses || {};
          });
        } catch (err) {
          console.error('[Designer] Failed to poll plugin status:', err);
        }
      };

      fetchStatus();
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }, [nodes, workflow?.status]);

    // Auto-close panel if selected node is deleted, and sync data for real-time updates
    useEffect(() => {
      if (selectedNode) {
        const refreshedNode = nodes.find((n) => n.id === selectedNode.id);
        if (!refreshedNode) {
          setSelectedNode(null);
          setIsPanelOpen(false);
        } else if (refreshedNode.data !== selectedNode.data) {
          // Sync if data reference changed (happens on updateNodes)
          setSelectedNode(refreshedNode);
        }
      }
    }, [nodes, selectedNode]);

    // ... (existing code)

    const onConnect = useCallback(
      (params) => {
        // 获取来源和目标节点
        const sourceNode = getNode(params.source);
        const targetNode = getNode(params.target);

        const enhancedParams = { ...params };

        // 【槽位重定向】如果来源是 SkillNode，强制连接到 AI Agent 的技能插槽 (Bottom)
        if (sourceNode?.type === 'skillNode' && targetNode?.type === 'aiAgent') {
          enhancedParams.targetHandle = 'tool-slot';
          enhancedParams.style = { strokeWidth: 3, stroke: '#722ed1', strokeDasharray: '5,5' }; // 紫色虚线表示能力流
          enhancedParams.markerEnd = { type: MarkerType.ArrowClosed, color: '#722ed1' };
          enhancedParams.className = 'skill-edge';
        } else if (sourceNode?.type === 'fetchMemory' && targetNode?.type === 'aiAgent') {
          // 【槽位重定向】获取记忆节点连接到 AI Agent 的记忆插槽 (Top)
          enhancedParams.targetHandle = 'memory-slot';
          enhancedParams.style = { strokeWidth: 3, stroke: '#52c41a', strokeDasharray: '5,5' }; // 绿色虚线表示记忆流
          enhancedParams.markerEnd = { type: MarkerType.ArrowClosed, color: '#52c41a' };
          enhancedParams.className = 'memory-edge';
        } else if (targetNode?.type === 'aiAgent' && params.targetHandle === 'knowledge-slot') {
          enhancedParams.style = { strokeWidth: 3, stroke: '#fa8c16', strokeDasharray: '5,5' };
          enhancedParams.markerEnd = { type: MarkerType.ArrowClosed, color: '#fa8c16' };
          enhancedParams.className = 'knowledge-edge';
        } else if (params.targetHandle) {
          const targetMeta = targetNode?.data?.pluginId ? getPluginMetaSync(targetNode.data.pluginId) : null;
          const targetSlot = Array.isArray(targetMeta?.slots)
            ? targetMeta.slots.find((s) => s.id === params.targetHandle)
            : null;
          if (targetSlot) {
            enhancedParams.style = { strokeWidth: 3, stroke: targetSlot.color || '#1890ff', strokeDasharray: '5,5' };
            enhancedParams.markerEnd = { type: MarkerType.ArrowClosed, color: targetSlot.color || '#1890ff' };
            enhancedParams.className = targetSlot.className || `${targetSlot.id}-edge`;
          }
        }

        setEdges((eds) =>
          addEdge(
            {
              ...enhancedParams,
              // Marker and type handled by defaultEdgeOptions unless overridden
            },
            eds,
          ),
        );
        setIsDirty(true);
      },
      [setEdges, getNode],
    );

    // 连接规则引擎：通过读取节点注册表 (NODE_REGISTRY) 中的契约动态判断连线合法性
    const isValidConnection = useCallback(
      (connection) => {
        // Early return for loop feedback handle to ensure it works even with complex addon rules
        if (connection.targetHandle === 'loop-in' || connection.targetHandle?.includes('loop')) {
          return true;
        }

        const sourceNode = getNode(connection.source);
        const targetNode = getNode(connection.target);

        if (!sourceNode || !targetNode) return false;

        const targetRules = getNodeConfig(targetNode)?.connectionRules;
        const sourceRules = getNodeConfig(sourceNode)?.connectionRules;

        // 1. 如果目标节点插槽声明了只接受特定的 source 节点类型
        if (targetRules?.allowFromHandle && connection.targetHandle) {
          const allowedSources = targetRules.allowFromHandle[connection.targetHandle];
          let isAllowed = false;
          if (allowedSources && allowedSources.includes(sourceNode.type)) {
            isAllowed = true;
          }
          // 如果是插件节点，直接查全局配置字典
          if (sourceNode.type === 'plugin-action' || sourceNode.isPlugin) {
            const pluginMeta = getPluginMetaSync(sourceNode.data?.pluginId);
            if (pluginMeta?.allowedSlots?.includes(connection.targetHandle)) {
              isAllowed = true;
            }
          }
          if (!isAllowed) {
            return false;
          }
        }

        // 2. 如果来源节点(addon)声明了自己只能挂载给特定的 target 节点和特定的 handle
        if (sourceRules?.allowAsTarget) {
          const isAllowed = sourceRules.allowAsTarget.some(
            (rule) =>
              (rule.nodeType === targetNode.type || (targetNode.type === 'plugin-action' && rule.nodeType === 'aiAgent')) &&
              rule.sourceHandleId === connection.targetHandle,
          );
          if (!isAllowed) return false;
        }

        // 3. 通用防御：防止普通流向节点(非addon)错误连接到保留的专属插槽(如 tool-slot)
        if (connection.targetHandle && connection.targetHandle.includes('slot')) {
          const pluginMeta = getPluginMetaSync(sourceNode.data?.pluginId);
          const isAddon = getNodeConfig(sourceNode)?.category === 'addon' || pluginMeta?.isAddon;
          if (!isAddon) return false;
        }

        return true;
      },
      [getNode],
    );

    // 实时扫描并更新 AI 节点的已连接技能数 (UI Display Only)
    useEffect(() => {
      let hasChanges = false;
      const updatedNodes = nodes.map((node) => {
        if (node.type === 'aiAgent') {
          const connectedSkillEdges = edges.filter(
            (e) => e.target === node.id && e.targetHandle === 'tool-slot',
          );
          const totalSkills = connectedSkillEdges.reduce((acc, edge) => {
            const source = nodes.find((n) => n.id === edge.source);
            return acc + (source?.data?.skillIds?.length || 0);
          }, 0);

          if (node.data.connectedSkillCount !== totalSkills) {
            hasChanges = true;
            return { ...node, data: { ...node.data, connectedSkillCount: totalSkills } };
          }
        }
        return node;
      });

      if (hasChanges) {
        setNodes(updatedNodes);
      }
    }, [edges, nodes.length, setNodes]); // 仅在拓扑结构或节点数量变化时触发，避免循环更新

    const onLayout = useCallback(
      (direction = 'LR') => {
        const g = new dagre.graphlib.Graph();
        // nodesep: 同一层级节点之间的垂直间距 (LR 时是垂直，TB 时是水平)
        // ranksep: 层级与层级之间的水平间距 (LR 时是水平，TB 时是垂直)
        // edgesep: 边与边之间的间距，增大这个值有助于减少连线重叠
        g.setGraph({
          rankdir: direction,
          nodesep: 150,
          ranksep: 200,
          edgesep: 100,
          ranker: 'network-simplex', // 使用网络单纯形算法，通常能得到更优的边长度
        });
        g.setDefaultEdgeLabel(() => ({}));

        // 模拟一个较大的节点尺寸，这能迫使 dagre 预留更多的线条通道空间
        const nodeWidth = 300;
        const nodeHeight = 120;

        nodes.forEach((node) => {
          g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
        });

        edges.forEach((edge) => {
          g.setEdge(edge.source, edge.target);
        });

        dagre.layout(g);

        const layoutedNodes = nodes.map((node) => {
          const nodeWithPosition = g.node(node.id);
          return {
            ...node,
            position: {
              x: nodeWithPosition.x - nodeWidth / 2,
              y: nodeWithPosition.y - nodeHeight / 2,
            },
          };
        });

        setNodes(layoutedNodes);
        setIsDirty(true);
        // 给渲染留出一帧时间，确保动画和线条连接更自然
        setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50);
      },
      [nodes, edges, setNodes, fitView],
    );

    const onNodeContextMenu = useCallback((event, node) => {
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        type: 'node',
      });
    }, []);

    const onPaneContextMenu = useCallback((event) => {
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'pane',
      });
    }, []);

    const onPaneClick = useCallback(() => setMenu(null), []);

    const duplicateNode = useCallback(() => {
      if (!menu?.nodeId) return;
      const original = nodes.find((n) => n.id === menu.nodeId);
      if (!original) return;

      const triggerTypes = [
        'schedule',
        'webhook',
        'dataChange',
        'click',
        'manual',
        'capability',
        'plugin-trigger',
      ];

      if (original.type === 'end' || triggerTypes.includes(original.type)) {
        message.warning(t('workflow.designer.cannotDuplicateTriggerOrEnd', '触发器节点和结束节点不能复制。'));
        setMenu(null);
        return;
      }

      const newNode = {
        ...original,
        id: generateShortId(
          nodes.map((n) => n.id),
          4,
          original.type === 'plugin-trigger'
            ? 'plt_'
            : original.type === 'plugin-action'
              ? 'pla_'
              : `${original.type}_`,
        ),
        position: { x: original.position.x + 30, y: original.position.y + 30 },
        selected: false,
      };
      setNodes((nds) => nds.concat(newNode));
      setIsDirty(true);
      setMenu(null);
    }, [menu, nodes, setNodes, t]);

    const deleteNodeFromMenu = useCallback(() => {
      if (!menu?.nodeId) return;
      setNodes((nds) => nds.filter((n) => n.id !== menu.nodeId));
      setIsDirty(true);
      setMenu(null);
    }, [menu, setNodes]);

    const onNodeClick = useCallback(
      (event, node) => {
        handleSettingsOpen({ id: node.id });
      },
      [handleSettingsOpen],
    );

    const getWorkflowUpdatePayload = useCallback(() => {
      // Find trigger node and extract config for backend scheduler
      // Identify all nodes that act as triggers
      const triggerNodes = nodes.filter((n) =>
        [
          'schedule',
          'webhook',
          'dataChange',
          'click',
          'manual',
          'capability',
          'plugin-trigger',
        ].includes(n.type),
      );

      if (triggerNodes.length === 0) {
        throw new Error(
          t('workflow.designer.errorNoTrigger', 'A workflow must have exactly one trigger node.'),
        );
      }

      if (triggerNodes.length > 1) {
        throw new Error(
          t(
            'workflow.designer.errorMultipleTriggers',
            'A workflow can only have one trigger node.',
          ),
        );
      }

      const triggerNode = triggerNodes[0];

      let triggerConfig = {};
      let triggerType = 'MANUAL';

      if (triggerNode) {
        triggerConfig = triggerNode.data || {};
        if (triggerNode.type === 'schedule') triggerType = 'SCHEDULE';
        else if (triggerNode.type === 'webhook') triggerType = 'WEBHOOK';
        else if (triggerNode.type === 'click') triggerType = 'MANUAL';
        else if (triggerNode.type === 'dataChange') triggerType = 'DATACHANGE';
        else if (triggerNode.type === 'capability') triggerType = 'CAPABILITY';
        else if (triggerNode.type === 'plugin-trigger') triggerType = 'PLUGIN';
        else triggerType = 'EVENT';
      }

      // Clean node data of transient fields before saving
      const cleanNodes = nodes.map((n) => {
        const { status, lastResult, lastError, ...cleanData } = n.data || {};
        return {
          ...n,
          data: cleanData,
        };
      });

      const { skillName, skillDescription, inputSchema, outputSchema, ...settingsValues } =
        settingsForm.getFieldsValue();

      const finalName = location.state?.employeeName
        ? `${location.state.employeeName} 的逻辑引擎`
        : settingsValues.name;

      return {
        ...settingsValues,
        name: finalName,
        skillConfig: {
          ...workflow?.skillConfig,
          name: location.state?.employeeName ? `${location.state.employeeName} 的逻辑引擎` : (skillName || settingsValues.name),
          description: skillDescription || '',
          inputSchema: inputSchema || {
            type: 'object',
            properties: {},
            required: [],
          },
          outputSchema: outputSchema || {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        // Persist status
        status: workflow?.status || 'INACTIVE',
        nodes: cleanNodes,
        edges,
        triggerType,
        triggerConfig,
      };
    }, [nodes, edges, workflow, settingsForm]);

    const onSave = async () => {
      // 1. 触发器校验
      const triggerNodes = nodes.filter((n) =>
        [
          'schedule',
          'webhook',
          'dataChange',
          'click',
          'manual',
          'capability',
          'plugin-trigger',
        ].includes(n.type),
      );
      if (triggerNodes.length === 0) {
        message.error('工作流缺少触发器节点。');
        return false;
      }
      if (triggerNodes.length > 1) {
        message.error('工作流只能有一个触发器节点。');
        return false;
      }

      // 2. 结束节点校验
      const hasEndNode = nodes.some((n) => n.type === 'end');
      if (!hasEndNode) {
        message.error('工作流缺少 "End" 节点。');
        return false;
      }

      const hide = message.loading(t('common.saving', 'Saving...'), 0);
      try {
        const payload = getWorkflowUpdatePayload();

        if (workflowId === 'new') {
          // Create mode
          const newWorkflow = await createWorkflow({
            ...payload,
            appId, // Ensure appId is passed
            name: workflow.name || 'Untitled Workflow',
            status: workflow.status || 'INACTIVE',
          });
          message.success(t('common.createSuccess'));
          isDirtyRef.current = false; // Sync update to bypass blocker
          setIsDirty(false); // Reset dirty BEFORE navigate to avoid blocker
          // Navigate to real ID (replace history to avoid back button issues)
          if (appId) {
            navigate(`/apps/${appId}/workflows/${newWorkflow._id}`, { replace: true });
          } else {
            navigate(`/organization/workflows/${newWorkflow._id}`, { replace: true });
          }
        } else {
          // Update mode
          const result = await updateWorkflow(workflowId, {
            ...payload,
            appId, // Essential for system workflow shadowing
            name: workflow.name, // Ensure name is synced if changed
          });

          // Special case: If we just saved a system workflow for the first time,
          // it may have been created in the DB and returned a new real ID.
          if (workflowId.startsWith('system_') && result.data?._id) {
            navigate(`/apps/${appId}/workflows/${result.data._id}`, { replace: true });
          }

          message.success(t('workflow.designer.save'));
          isDirtyRef.current = false;
          setIsDirty(false);
        }
        return true;
      } catch (err) {
        // Display specific validation error or generic failure
        message.error(err.message || t('common.operationFailed'));
        return false;
      } finally {
        hide();
      }
    };

    // Sync saveRef
    useEffect(() => {
      saveRef.current = onSave;
    }, [onSave]);

    const handleExport = () => {
      const exportData = {
        name: workflow?.name,
        description: workflow?.description,
        nodes,
        edges,
        triggerType: workflow?.triggerType,
        skillConfig: workflow?.skillConfig,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflow?.name || 'workflow'}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('common.exportSuccess', 'Workflow exported successfully'));
    };

    const handleImport = (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          if (!importedData.nodes || !Array.isArray(importedData.nodes)) {
            throw new Error('Invalid workflow format: missing nodes');
          }

          // Update workflow metadata (name, description) if available
          if (importedData.name) {
            setWorkflow((prev) => ({
              ...prev,
              name: importedData.name,
              description: importedData.description,
            }));
            settingsForm.setFieldsValue({
              name: importedData.name,
              description: importedData.description,
            });
          }

          setNodes(
            importedData.nodes.map((n) => ({
              ...n,
              selected: false,
              data: { ...n.data, status: null, lastResult: null, lastError: null },
            })),
          );

          setEdges(importedData.edges || []);
          setIsDirty(true);
          message.success(t('common.importSuccess', 'Workflow imported successfully'));
        } catch (err) {
          console.error('Import failed:', err);
          message.error(t('common.importFailed', 'Failed to import workflow: ') + err.message);
        }
      };
      reader.readAsText(file);
      return false; // Prevent auto-upload
    };

    // No global SSE effect

    const handleTestRun = async () => {
      // 1. 触发器校验
      const triggerNodes = nodes.filter((n) =>
        [
          'schedule',
          'webhook',
          'dataChange',
          'click',
          'manual',
          'capability',
          'plugin-trigger',
        ].includes(n.type),
      );
      if (triggerNodes.length === 0) {
        message.error('工作流缺少触发器节点。');
        return;
      }
      if (triggerNodes.length > 1) {
        message.error('工作流只能有一个触发器节点。');
        return;
      }

      // 2. 结束节点校验
      const hasEndNode = nodes.some((n) => n.type === 'end');
      if (!hasEndNode) {
        message.error('工作流缺少 "End" 节点。测试运行前请先添加一个结束节点以定义输出。');
        return;
      }

      // Auto-save if dirty before full test run
      if (isDirty) {
        const success = await onSave();
        if (!success) return;
      }
      if (workflowId === 'new') {
        message.warning(
          t('workflow.designer.saveToRun', 'Please save the workflow before running.'),
        );
        return;
      }

      // 0. Force save current state to DB first to ensure backend has latest graph
      try {
        const payload = getWorkflowUpdatePayload();
        await updateWorkflow(workflowId, payload);
      } catch (err) {
        console.error('Failed to save before run', err);
        message.error(
          t('workflow.designer.saveBeforeRunFailed', 'Failed to save workflow before run'),
        );
        return;
      }

      // Reset all node statuses first
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            status: null,
            lastResult: null,
            lastError: null,
          },
        })),
      );
      // Reset all edges to default inactive styling first
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          animated: false,
          style: {
            ...edge.style,
            stroke: '#d9d9d9',
            strokeWidth: 1.5,
          },
        }))
      );
      setExecutionLog([]);

      const hideLoading = message.loading(t('workflow.designer.running'), 0);

      // 1. Establish SSE connection using POST to stream-execute
      const abortController = fetchEventSource(
        streamWorkflowExecute(workflowId),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        {
          onmessage: (msg) => {


            try {
              const { event: rawEvent, data } = msg;
              let payload = JSON.parse(data);
              let event = rawEvent;




              if (
                payload.type === 'data' &&
                Array.isArray(payload.data) &&
                payload.data.length > 0
              ) {
                const inner = payload.data[0];
                event = inner.type; // 提取实际事件类型: node:start, node:progress 等
                payload = inner;
              } else if ((!event || event === 'message') && payload.type) {
                event = payload.type;
              }


              // Prevent subworkflow execution events from leaking or overriding node/edge statuses on the parent workflow designer
              if (payload && payload.workflowId && payload.workflowId !== workflowId) {
                return;
              }

              // Print log to browser developer console if it is a log event
              if (event === 'node:log' || event === 'log' || (event === 'node:progress' && payload.status === 'log')) {
                console.log('%c' + (payload.message || ''), 'color: #722ed1; font-weight: bold; background: #f9f0ff; padding: 2px 4px; border-radius: 4px;');
              }

              // Append to execution log

              setExecutionLog((prev) => [
                {
                  id: Date.now() + Math.random(),
                  time: new Date().toLocaleTimeString(),
                  event,
                  nodeId: payload.nodeId,
                  message:
                    payload.error ||
                    (event === 'node:log' || event === 'log' || (event === 'node:progress' && payload.status === 'log')
                      ? payload.message
                      : payload.result
                        ? `Success: ${JSON.stringify(payload.result).substring(0, 50)}...`
                        : 'Node active'),
                  type: (event === 'node:log' || event === 'log' || (event === 'node:progress' && payload.status === 'log')) ? 'info' : (event?.includes('error') ? 'error' : 'info'),


                },
                ...prev,
              ]);


              if (event === 'node:start') {
                setNodes((nds) =>
                  nds.map((n) =>
                    n.id === payload.nodeId ? { ...n, data: { ...n.data, status: 'running' } } : n,
                  ),
                );
              } else if (event === 'node:success') {
                setNodes((nds) =>
                  nds.map((n) =>
                    n.id === payload.nodeId
                      ? {
                          ...n,
                          data: {
                            ...n.data,
                            status: 'success',
                            lastResult: {
                              result: payload.result,
                              resolvedConfig: payload.resolvedConfig,
                            },
                          },
                        }
                      : n,
                  ),
                );
                // Highlight traversed edges in green with flow animation!
                setEdges((eds) =>
                  eds.map((edge) => {
                    if (edge.source === payload.nodeId) {
                      const nextHandleId = payload.result?.matchedCase || payload.result?.nextHandleId;
                      const isMatched = !nextHandleId || edge.sourceHandle === nextHandleId;
                      if (isMatched) {
                        return {
                          ...edge,
                          animated: true,
                          style: {
                            ...edge.style,
                            stroke: '#52c41a',
                            strokeWidth: 3,
                          },
                        };
                      }
                    }
                    return edge;
                  })
                );
              } else if (
                event === 'node:progress' ||
                ([
                  'text-delta',
                  'tool-input-start',
                  'tool-input-delta',
                  'tool-output-available',
                ].includes(event) &&
                  payload.nodeId)
              ) {
                // 处理执行过程中的进度更新 (如 AI 工具调用或流式文本)
                const mappedStatus =
                  event === 'tool-input-start'
                    ? 'running'
                    : (event === 'node:progress' && payload.status === 'tool-result') ||
                        event === 'tool-output-available'
                      ? 'success'
                      : 'running'; // text-delta 默认维持 running

                setNodes((nds) =>
                  nds.map((n) =>
                    n.id === payload.nodeId
                      ? {
                          ...n,
                          data: {
                            ...n.data,
                            status: mappedStatus,
                            // 统一构造 lastProgress 格式以兼容旧逻辑
                            lastProgress: {
                              ...payload,
                              status:
                                payload.status || (event === 'text-delta' ? 'text-delta' : event),
                            },
                          },
                        }
                      : n,
                  ),
                );
              } else if (event === 'node:error') {
                const nodeLabel =
                  nodes.find((n) => n.id === payload.nodeId)?.data?.label || payload.nodeId;
                // message.error(`Step "${nodeLabel}" failed: ${payload.error || 'Unknown error'}`);
                setNodes((nds) =>
                  nds.map((n) =>
                    n.id === payload.nodeId
                      ? { ...n, data: { ...n.data, status: 'error', lastError: payload.error } }
                      : n,
                  ),
                );
              } else if (event === 'workflow:success') {
                setNodes((nds) =>
                  nds.map((n) => {
                    if (n.data?.status === 'running') {
                      return { ...n, data: { ...n.data, status: 'success' } };
                    }
                    return n;
                  }),
                );
                message.success(t('workflow.designer.success'));
                hideLoading();
                setTimeout(() => {
                  closeConnection();
                }, 500);
              } else if (event === 'workflow:error' || event === 'error') {
                // 优先显示具体报错信息，如果没有则显示通用翻译
                const errMsg = payload.error || payload.content || payload.errorText || t('workflow.designer.error');
                message.error(errMsg);
                setNodes((nds) =>
                  nds.map((n) => {
                    const isTarget = payload.nodeId ? n.id === payload.nodeId : n.data?.status === 'running';
                    if (isTarget) {
                      return { ...n, data: { ...n.data, status: 'error', lastError: errMsg } };
                    }
                    return n;
                  }),
                );
                hideLoading();
                closeConnection();
              } else if (event === 'finish') {
                if (payload.finishReason === 'error') {
                  const errMsg = payload.error || payload.content || t('workflow.designer.error');
                  message.error(errMsg);
                  setNodes((nds) =>
                    nds.map((n) => {
                      const isTarget = payload.nodeId ? n.id === payload.nodeId : n.data?.status === 'running';
                      if (isTarget) {
                        return { ...n, data: { ...n.data, status: 'error', lastError: errMsg } };
                      }
                      return n;
                    }),
                  );
                } else {
                  message.success(t('workflow.designer.success'));
                }
                hideLoading();
                closeConnection();
              }
            } catch (e) {
              console.error('Error parsing SSE message', e);
            }
          },
          onerror: (err) => {
            console.error('SSE Error:', err);
            hideLoading();
            // 如果 Error 对象里有 message（比如我们从 400 响应中解析出来的），就显示它
            message.error(err.message || t('workflow.designer.error'));

            // 🛡️ Robustness: Reset any nodes stuck in 'running' to 'error' to ensure canvas loader resolves
            setNodes((nds) =>
              nds.map((n) =>
                n.data?.status === 'running'
                  ? { ...n, data: { ...n.data, status: 'error', lastError: err.message || 'Connection lost' } }
                  : n
              )
            );

            // 抛出错误以停止 fetchEventSource 的自动重试
            throw err;
          },
        },
      );

      const closeConnection = () => {
        if (abortController) abortController();
      };

      // Safety timeout - internal safeguard to prevent leaked connections
      setTimeout(() => {
        hideLoading();
        closeConnection();
      }, 600000); // 10 minutes
    };

    const onUpdateNodeData = (values) => {
      let finalData = { ...values };

      // Convert friendly schedule UI back to Cron
      if (selectedNode.type === 'schedule' && values.scheduleMode !== 'advanced') {
        const time = values.time ? dayjs(values.time) : dayjs();
        const min = time.minute();
        const hour = time.hour();

        let cron = `${min} ${hour} * * *`;
        if (values.scheduleMode === 'weekly') {
          cron = `${min} ${hour} * * ${values.dayOfWeek || '*'}`;
        } else if (values.scheduleMode === 'monthly') {
          cron = `${min} ${hour} ${values.dayOfMonth || '*'} * *`;
        }
        finalData.cron = cron;
        finalData.time = time.format('HH:mm');
      } else if (selectedNode.type === 'schedule' && values.time) {
        finalData.time = dayjs(values.time).format('HH:mm');
      }

      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === selectedNode.id) {
            return { ...node, data: { ...node.data, ...finalData } };
          }
          return node;
        }),
      );
      setIsDirty(true);
      setIsPanelOpen(false);
    };

    const onDragOver = useCallback((event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
      (event) => {
        event.preventDefault();

        const type = event.dataTransfer.getData('application/reactflow');
        const pluginId = event.dataTransfer.getData('application/plugin-id');

        console.log('[Designer] Node dropped:', type, pluginId);

        // check if the dropped element is valid
        if (typeof type === 'undefined' || !type) {
          return;
        }

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const initialDataRaw = event.dataTransfer.getData('application/initial-data');
        let initialData = {};
        try {
          if (initialDataRaw) initialData = JSON.parse(initialDataRaw);
        } catch (e) {
          console.error('Failed to parse initial data', e);
        }

        const triggerTypes = [
          'schedule',
          'webhook',
          'dataChange',
          'click',
          'manual',
          'capability',
          'plugin-trigger',
        ];

        let generatedId = generateShortId(
          nodes.map((n) => n.id),
          4,
          type === 'plugin-trigger' ? 'plt_' : type === 'plugin-action' ? 'pla_' : `${type}_`,
        );

        if (type === 'end') {
          generatedId = 'end';
        } else if (triggerTypes.includes(type)) {
          generatedId = 'start';
        }

        const nodeConfig = fullRegistry[type];
        const newNode = {
          id: generatedId,
          type,
          position,
          data: {
            ...(nodeConfig?.initialData || {}),
            ...initialData,
            pluginId: pluginId || initialData.pluginId || nodeConfig?.initialData?.pluginId,
          },
        };

        setNodes((nds) => nds.concat(newNode));
        setIsDirty(true);
      },
      [screenToFlowPosition, setNodes, fullRegistry, nodes],
    );

    const handlePublish = async (data) => {
      try {
        const updated = await publishWorkflow(workflowId, data);
        setWorkflow(updated);
        message.success(t('workflow.designer.publishSuccess'));
        setPublishModalOpen(false);
      } catch (err) {
        console.error(err);
        message.error(err.message || t('common.operationFailed'));
      }
    };

    const handleToggleStatus = (checked) => {
      // Req: Confirmation before toggling
      Modal.confirm({
        title: t('common.confirm', 'Confirm'),
        content: t(
          'workflow.designer.statusConfirm',
          'Are you sure you want to change the status?',
        ),
        onOk: async () => {
          try {
            const status = checked ? 'ACTIVE' : 'INACTIVE';
            const updated = await toggleWorkflowStatus(workflowId, status);
            setWorkflow((prev) => ({ ...prev, status: updated.status }));
            message.success(t('workflow.designer.statusUpdated'));
          } catch (err) {
            console.error(err);
            message.error(err.message || t('common.operationFailed'));
          }
        },
      });
    };

    const handleReset = () => {
      Modal.confirm({
        title: t('common.confirm', 'Confirm'),
        content: t(
          'workflow.designer.resetConfirm',
          'Are you sure you want to reset this workflow to the built-in system default? All customizations will be lost.',
        ),
        okText: t('common.confirm', 'Yes'),
        cancelText: t('common.cancel', 'No'),
        onOk: async () => {
          try {
            const res = await resetWorkflow(workflowId, appId);
            setWorkflow(res);
            setNodes(res.nodes || []);
            setEdges(res.edges || []);
            setIsDirty(false);
            message.success(t('workflow.designer.resetSuccess', 'Reset successfully'));
          } catch (err) {
            message.error(err.message || t('common.operationFailed', 'Operation failed'));
          }
        },
      });
    };

    // Manual save is now the primary way via the Header button
    // as per user request to handle it globally.

    const shouldHideHeader =
      hideHeader || new URLSearchParams(location.search).get('hideHeader') === 'true';

    if (!workflow || metadataLoading) {
      return (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#f0f2f5',
            overflow: 'hidden',
          }}
        >
          {/* Header Skeleton */}
          <div
            style={{
              height: 64,
              background: '#fff',
              borderBottom: '1px solid #d9d9d9',
              display: 'flex',
              alignItems: 'center',
              padding: '0 24px',
              justifyContent: 'space-between',
            }}
          >
            <Skeleton.Button active style={{ width: 200 }} />
            <Space>
              <Skeleton.Button active style={{ width: 80 }} />
              <Skeleton.Button active style={{ width: 80 }} />
            </Space>
          </div>

          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {/* Floating Sidebar Skeleton (Matching NodeSidebar style) */}
            <div
              style={{
                position: 'absolute',
                left: 20,
                top: 20,
                width: 250,
                zIndex: 10,
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <Skeleton.Button active style={{ width: '100%', height: 32 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton active paragraph={{ rows: 1 }} title={false} />
                <Skeleton active paragraph={{ rows: 1 }} title={false} />
                <Skeleton active paragraph={{ rows: 1 }} title={false} />
              </div>
            </div>

            {/* Canvas Skeleton */}
            <div
              style={{
                width: '100%',
                height: '100%',
                background: '#fafafa',
                backgroundImage: 'radial-gradient(#d9d9d9 1px, transparent 0)',
                backgroundSize: '20px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Spin size="large" />
              <div style={{ marginTop: 16, color: '#1890ff', fontWeight: 500 }}>
                {metadataLoading ? t('workflow.metadata.loading') : t('common.loading')}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <Layout
        style={{
          height: shouldHideHeader ? '100%' : '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <style>{edgeStyles}</style>
        {!shouldHideHeader && (
          <PageHeader
            onBack={() => {
              if (location.state?.backPath) {
                navigate(location.state.backPath);
              } else if (appId) {
                navigate(`/apps/${appId}/workflows`);
              } else {
                navigate('/admin/skills');
              }
            }}
            title={
              <EditableTitle
                value={
                  location.state?.employeeName
                    ? `${location.state.employeeName} 的逻辑引擎`
                    : (workflow?.scope === 'SYSTEM'
                      ? t(`workflow.builtin.${workflow.name}`, workflow.name)
                      : workflow?.name || t('workflow.designer.designerTitle'))
                }
                level={4}
                showEditIcon={!location.state?.employeeName && workflow?.scope !== 'SYSTEM'}
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  margin: 0,
                  padding: 0,
                  color: '#262626',
                }}
                onSave={async (newName) => {
                  if (workflow?.scope === 'SYSTEM') return;
                  
                  // Always update local state immediately for UI response
                  setWorkflow((prev) => ({ ...prev, name: newName }));

                  if (workflowId === 'new') {
                    // For new workflow, only update local state. Save will happen on explicit "Save" button.
                    setIsDirty(true);
                    return;
                  }

                  // For existing workflow, auto-save the name change
                  if (!workflow) return;
                  try {
                    await updateWorkflow(workflowId, { name: newName });
                    message.success(t('common.updateSuccess'));
                  } catch (err) {
                    message.error(t('common.updateFailed'));
                  }
                }}
              />
            }
            tags={
              workflow?.scope === 'ORGANIZATION' ? (
                <Tag color="#722ed1">{t('workflow.list.org')}</Tag>
              ) : workflow?.scope === 'SYSTEM' ? (
                <Tag color="#faad14">{t('workflow.list.builtIn', 'Built-in')}</Tag>
              ) : (
                <Tag>{t('role.scopeApp')}</Tag>
              )
            }
            extra={
              <>
                {workflow?.scope !== 'SYSTEM' && (
                  <Space style={{ marginRight: 16 }}>
                    <span style={{ fontSize: 13, color: '#666' }}>{t('organization.status')}:</span>
                    <Switch
                      checked={workflow?.status === 'ACTIVE'}
                      onChange={handleToggleStatus}
                      checkedChildren={t('organization.statusActive')}
                      unCheckedChildren={t('organization.statusDisabled')}
                      loading={!workflow}
                    />
                  </Space>
                )}
                {(workflow?.scope === 'SYSTEM' || !!workflow?.workflowKey) && (
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>
                    {t('common.reset', 'Reset')}
                  </Button>
                )}
                {workflow?.scope !== 'SYSTEM' && (
                  <Button
                    icon={<SendOutlined />}
                    onClick={() => {
                      setPublishModalOpen(true);
                    }}
                    disabled={workflow?.scope === 'ORGANIZATION'}
                  >
                    {workflow?.scope === 'ORGANIZATION'
                      ? t('workflow.publish.alreadyPublished')
                      : t('workflow.publish.confirm')}
                  </Button>
                )}
                <Badge dot={isDirty} offset={[-2, 2]}>
                  <Button
                    icon={<SaveOutlined />}
                    onClick={onSave}
                    type={isDirty ? 'primary' : 'default'}
                    ghost={isDirty}
                  >
                    {t('common.save')}
                  </Button>
                </Badge>
                {workflow?.scope !== 'SYSTEM' && (
                  <Button icon={<SettingOutlined />} onClick={() => setSettingsModalOpen(true)}>
                    {t('workflow.designer.settings', 'Settings')}
                  </Button>
                )}
                <Button icon={<ExportOutlined />} onClick={handleExport}>
                  {t('common.export', 'Export')}
                </Button>
                <Upload beforeUpload={handleImport} showUploadList={false} accept=".json">
                  <Button icon={<ImportOutlined />}>{t('common.import', 'Import')}</Button>
                </Upload>
                <Tooltip title={t('workflow.designer.autoLayout', 'Auto Layout')}>
                  <Button icon={<ApartmentOutlined />} onClick={() => onLayout('LR')} />
                </Tooltip>
                <Button icon={<PlayCircleOutlined />} type="primary" onClick={handleTestRun}>
                  {t('workflow.designer.testRun')}
                </Button>
              </>
            }
          />
        )}
        <Content style={{ flex: 1, position: 'relative', height: '100%' }}>
          <Splitter
            style={{ height: '100%' }}
            onResize={(sizes) => {
              if (sizes[1] <= 50) {
                setIsPanelOpen(false);
                setSelectedNode(null);
                setAiPanelOpen(false);
              }
            }}
          >
            <Splitter.Panel>
              <div
                ref={reactFlowWrapper}
                style={{ width: '100%', height: '100%', position: 'relative' }}
              >
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  isValidConnection={isValidConnection}
                  onNodeClick={onNodeClick}
                  nodeTypes={nodeTypes}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onNodeContextMenu={onNodeContextMenu}
                  onPaneContextMenu={onPaneContextMenu}
                  onPaneClick={onPaneClick}
                  deleteKeyCode={['Backspace', 'Delete']}
                  multiSelectionKeyCode={['Meta', 'Shift']}
                  snapToGrid
                  snapGrid={[15, 15]}
                  fitView
                  fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                  defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
                  defaultEdgeOptions={{
                    type: 'default',
                    animated: true,
                    style: { strokeWidth: 2, stroke: '#b1b1b7' },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#b1b1b7' },
                  }}
                >
                  <Background color="#f0f2f5" gap={20} variant="dots" />
                  <Controls showInteractive={false} position="bottom-right" />
                  <MiniMap
                    position="bottom-left"
                    style={{ height: 120, width: 180, borderRadius: 8 }}
                    zoomable
                    pannable
                  />
                  <NodeSidebar />
                  {/* 🚀 Reusable Platform-aligned AgentDock on Workflow Canvas */}
                  <AgentDock
                    placement="right"
                    style={{ bottom: '160px', zIndex: 100 }}
                    onSelect={() => {
                      setSelectedNode(null);
                      setIsPanelOpen(false);
                      setAiPanelOpen(true);
                    }}
                  />

                  {/* Context Menu Overlay */}
                  {menu && (
                    <div
                      style={{
                        position: 'fixed',
                        top: menu.y,
                        left: menu.x,
                        zIndex: 1000,
                        background: '#fff',
                        boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08)',
                        borderRadius: '8px',
                        padding: '4px',
                        minWidth: '160px',
                      }}
                    >
                      {menu.type === 'node' ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <Button
                            type="text"
                            block
                            style={{
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                            icon={<CopyOutlined />}
                            onClick={duplicateNode}
                          >
                            {t('common.duplicate', 'Duplicate')}
                          </Button>
                          <Button
                            type="text"
                            block
                            style={{
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                            icon={<DeleteOutlined />}
                            danger
                            onClick={deleteNodeFromMenu}
                          >
                            {t('common.delete', 'Delete')}
                          </Button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <Button
                            type="text"
                            block
                            style={{ textAlign: 'left' }}
                            icon={<PlayCircleOutlined />}
                            onClick={handleTestRun}
                          >
                            {t('workflow.designer.testRun')}
                          </Button>
                          <Divider style={{ margin: '4px 0' }} />
                        </div>
                      )}
                    </div>
                  )}
                </ReactFlow>
              </div>
            </Splitter.Panel>

            <Splitter.Panel
              // collapsible
              size={(isPanelOpen || aiPanelOpen) ? undefined : 0}
              defaultSize={420}
              min={420}
              max={600}
            >
              {selectedNode ? (
                <div
                  style={{
                    height: '100%',
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onKeyDown={(e) => {
                    // Prevent key events inside the settings panel from bubbling up to ReactFlow or global keydown listeners
                    e.stopPropagation();
                  }}
                >
                  {/* Panel Header */}
                  <div
                    style={{
                      padding: '16px 24px',
                      borderBottom: '1px solid #f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#fff',
                    }}
                  >
                    <Space size={16}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                        }}
                      >
                        {['plugin-action', 'plugin-trigger'].includes(selectedNode?.type)
                          ? (() => {
                              const meta = getPluginMetaSync(selectedNode?.data?.pluginId);
                              return getPluginIcon(selectedNode?.data?.icon || meta?.icon, {
                                fontSize: 20,
                                color: selectedNode?.data?.iconColor || meta?.iconColor,
                              });
                            })()
                          : NODE_ICONS[selectedNode?.type] || NODE_ICONS.default}
                      </div>
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <EditableTitle
                            value={getNodeLabel(selectedNode, t)}
                            level={5}
                            style={{
                              fontWeight: 600,
                              fontSize: '16px',
                              color: '#262626',
                              lineHeight: '1.4',
                              margin: 0,
                              padding: 0,
                            }}
                            onSave={async (newLabel) => {
                              setNodes((nds) =>
                                nds.map((n) =>
                                  n.id === selectedNode.id
                                    ? { ...n, data: { ...n.data, label: newLabel } }
                                    : n
                                )
                              );
                              setIsDirty(true);
                            }}
                          />
                          {selectedNode?.data?.description && (
                            <Tooltip title={selectedNode.data.description}>
                              <InfoCircleOutlined
                                style={{ color: '#8c8c8c', fontSize: 13, cursor: 'help', marginLeft: 4 }}
                              />
                            </Tooltip>
                          )}
                        </div>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}
                        >
                          <Tag
                            bordered={false}
                            style={{
                              fontSize: 11,
                              margin: 0,
                              padding: '0 4px',
                              background: '#f0f0f0',
                              color: '#8c8c8c',
                            }}
                          >
                            ID: {selectedNode?.id}
                          </Tag>
                        </div>
                      </div>
                    </Space>
                    <Space>
                      {selectedNode?.type !== 'schedule' && (
                        <Tooltip title={t('workflow.designer.runTest')}>
                          <Button
                            type="text"
                            icon={<PlayCircleOutlined style={{ fontSize: 16, color: '#52c41a' }} />}
                            loading={debugLoading}
                            onClick={handleTestNode}
                          />
                        </Tooltip>
                      )}
                      <Tooltip title={t('common.close', 'Close')}>
                        <Button
                          type="text"
                          icon={<CloseOutlined style={{ fontSize: 14, color: '#8c8c8c' }} />}
                          onClick={() => {
                            setIsPanelOpen(false);
                            setSelectedNode(null);
                          }}
                        />
                      </Tooltip>
                      <Tooltip title={t('common.delete', 'Delete')}>
                        <Button
                          type="text"
                          icon={<DeleteOutlined style={{ fontSize: 14 }} />}
                          danger
                          onClick={() => {
                            setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                            setIsPanelOpen(false);
                            setSelectedNode(null);
                          }}
                        />
                      </Tooltip>
                    </Space>
                  </div>

                  {/* Panel Content */}
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <NodePropertyPanel
                      selectedNode={selectedNode}
                      setNodes={setNodes}
                      nodes={nodes}
                      edges={edges}
                      forms={forms}
                      appId={appId}
                    />
                  </div>
                </div>
              ) : aiPanelOpen ? (
                <div
                  style={{
                    height: '100%',
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <AgentWorkspace
                    appId={appId}
                    minimized={!aiPanelOpen}
                    onMinimizedChange={(min) => setAiPanelOpen(!min)}
                    defaultDisplayMode="panel"
                    onDisplayModeChange={() => {}}
                  />
                </div>
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#fafafa',
                  }}
                >
                  <Empty
                    description={t(
                      'workflow.designer.selectNodeToConfigure',
                      'Select a node to configure',
                    )}
                  />
                </div>
              )}
            </Splitter.Panel>
          </Splitter>

          {/* Floating Log Panel (Bottom) */}
          {logOpen && (
            <Card
              title={
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <HistoryOutlined /> {t('workflow.designer.executionLog', 'Execution Log')}
                  </Space>
                  <Button type="text" size="small" onClick={() => setLogOpen(false)}>
                    ×
                  </Button>
                </Space>
              }
              style={{
                position: 'absolute',
                bottom: 24,
                left: 240,
                right: 24,
                zIndex: 1000,
                maxHeight: 250,
                borderRadius: 12,
                boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
              }}
              bodyStyle={{ padding: 0, overflowY: 'auto', maxHeight: 200 }}
            >
              <div style={{ padding: '8px 16px' }}>
                {executionLog.length === 0 ? (
                  <Empty description="No logs yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  executionLog.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '8px 0',
                        borderBottom: '1px solid #f0f0f0',
                        display: 'flex',
                        gap: 12,
                        fontSize: '12px',
                      }}
                    >
                      <Text type="secondary" style={{ width: 60 }}>
                        {log.time}
                      </Text>
                      <Tag
                        color={log.type === 'error' ? 'red' : 'blue'}
                        style={{ fontSize: '10px' }}
                      >
                        {log.event}
                      </Tag>
                      <Text strong style={{ width: 100 }}>
                        {log.nodeId || 'Workflow'}
                      </Text>
                      <Text style={{ flex: 1 }} ellipsis title={log.message}>
                        {log.message}
                      </Text>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
          {/* Workflow Global Settings Drawer */}
          <ResizableDrawer
            title={t('workflow.designer.workflowSettings', 'Workflow Settings')}
            open={settingsModalOpen}
            onClose={() => setSettingsModalOpen(false)}
            destroyOnClose
            defaultWidth={480}
            minWidth={400}
            maxWidth={800}
            extra={
              <Space>
                <Button onClick={() => setSettingsModalOpen(false)}>{t('common.cancel')}</Button>
                <Button
                  type="primary"
                  onClick={async () => {
                    try {
                      const values = await settingsForm.validateFields();

                      const cleanValues = {
                        ...values,
                        skillConfig: {
                          ...workflow?.skillConfig,
                          description: values.skillDescription,
                          name: values.skillName || values.name,
                          inputSchema: values.inputSchema,
                          outputSchema: values.outputSchema,
                        },
                      };
                      delete cleanValues.skillDescription;
                      delete cleanValues.skillName;
                      delete cleanValues.inputSchema;
                      delete cleanValues.outputSchema;

                      // Call API to update
                      await updateWorkflow(workflowId, cleanValues);
                      // Update local state
                      setWorkflow((prev) => ({ ...prev, ...cleanValues }));
                      setSettingsModalOpen(false);
                      message.success(t('common.updateSuccess'));
                    } catch (error) {
                      console.error(error);
                      // client-side errors are usually non-retriable:
                      const errorData = error.response ? await error.response.json() : null;
                      const errorMsg =
                        errorData?.error?.message ||
                        errorData?.message ||
                        error.message ||
                        t('common.updateFailed');
                      if (!error.errorFields) {
                        message.error(errorMsg);
                      }
                    }
                  }}
                >
                  {t('common.save')}
                </Button>
              </Space>
            }
          >
            <Form
              form={settingsForm}
              layout="vertical"
              initialValues={{
                scope: workflow?.scope || 'APP',
                isSkill: workflow?.isSkill || false,
                category: workflow?.category || 'GENERAL',
                name: location.state?.employeeName ? `${location.state.employeeName} 的逻辑引擎` : workflow?.name,
                description: workflow?.description,
                skillDescription: workflow?.skillConfig?.description,
                skillName: workflow?.skillConfig?.name,
                inputSchema: workflow?.skillConfig?.inputSchema || {
                  type: 'object',
                  properties: {},
                  required: [],
                },
                outputSchema: workflow?.skillConfig?.outputSchema || {
                  type: 'object',
                  properties: {},
                  required: [],
                },
              }}
            >
              <Form.Item
                name="name"
                label={t('common.name')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Input disabled={!!location.state?.employeeName} />
              </Form.Item>
              <Form.Item name="category" label="分类">
                <Select>
                  <Select.Option value="GENERAL">通用流程</Select.Option>
                  <Select.Option value="AI_MEMORY_RECALL">加载知识 - 召回策略</Select.Option>
                  <Select.Option value="AI_MEMORY_DISTILL">加载知识 - 提炼策略</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="description" label={t('common.description')}>
                <Input.TextArea rows={3} />
              </Form.Item>

              <Divider />

              <Form.Item
                name="isSkill"
                label={t('workflow.designer.isSkill', 'As AI Skill')}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) =>
                  prevValues.isSkill !== currentValues.isSkill
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue('isSkill') ? (
                    <Card size="small" style={{ background: '#fafafa', marginTop: 8 }}>
                      <Form.Item
                        name="skillName"
                        label={t('workflow.publish.skillName', 'Skill Name')}
                        extra={t('workflow.designer.toolNamePattern')}
                      >
                        <Input placeholder={workflow?.name} />
                      </Form.Item>
                      <Form.Item
                        name="skillDescription"
                        label={t('workflow.publish.skillDesc', 'Skill Instruction (AI Prompt)')}
                        rules={[{ required: true, message: t('common.required') }]}
                        tooltip={t('workflow.publish.skillDescTip')}
                      >
                        <Input.TextArea
                          rows={6}
                          placeholder={t('workflow.publish.skillDescPlaceholder')}
                        />
                      </Form.Item>

                      <Form.Item name="inputSchema" noStyle>
                        <ParameterEditor title={t('workflow.nodes.skill.inputParams')} />
                      </Form.Item>

                      <Divider />

                      <Form.Item name="outputSchema" noStyle>
                        <ParameterEditor title={t('workflow.nodes.skill.outputParams')} />
                      </Form.Item>
                    </Card>
                  ) : null
                }
              </Form.Item>
            </Form>
          </ResizableDrawer>



          <PublishModal
            open={publishModalOpen}
            onClose={() => setPublishModalOpen(false)}
            workflow={workflow}
            onPublish={handlePublish}
          />
        </Content>
      </Layout>
    );
  },
);

const NodePropertyPanel = React.memo(({ selectedNode, setNodes, nodes, edges, forms, appId }) => {
  const { getNodeConfig } = useWorkflow();
  const PropertyComponent = getNodeConfig(selectedNode)?.properties;

  if (!PropertyComponent) {
    return (
      <div style={{ padding: 20 }}>
        <Empty description="No settings for this node" />
      </div>
    );
  }

  return (
    <div key={`node-prop-container-${selectedNode.id}`} style={{ height: '100%' }}>
      <PropertyComponent
        key={`node-prop-${selectedNode.id}`}
        node={selectedNode}
        setNodes={setNodes}
        currentNodeId={selectedNode?.id}
        forms={forms}
        appId={appId}
      />
    </div>
  );
});

const WorkflowDesigner = forwardRef((props, ref) => {
  const { appId, workflowId } = useParams();
  const actualAppId = props.overrideAppId || appId;
  const actualWorkflowId = props.overrideWorkflowId || workflowId;

  return (
    <ReactFlowProvider>
      <WorkflowProvider appId={actualAppId} nodeRegistry={NODE_REGISTRY}>
        <AgentDockProvider
          appId={actualAppId}
          targetId={actualWorkflowId || 'new'}
          scenario={EMPLOYEE_SCENARIOS.WORKFLOW}
        >
          <WorkflowDesignerContent {...props} ref={ref} />
        </AgentDockProvider>
      </WorkflowProvider>
    </ReactFlowProvider>
  );
});

export default WorkflowDesigner;
