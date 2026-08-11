import React, { useRef, useImperativeHandle, forwardRef, useState, useMemo } from 'react';
import {
  Input,
  Button,
  Modal,
  Tooltip,
  Space,
  Typography,
  List,
  Divider,
  theme,
  Badge,
  Dropdown,
  Tree,
} from 'antd';
import { ExpandAltOutlined, CodeOutlined, SearchOutlined, BlockOutlined } from '@ant-design/icons';
import VariableSelector from './VariableSelector';
import { useTranslation } from 'react-i18next';
import Draggable from 'react-draggable';
import VariableMarkdownEditor from './VariableMarkdownEditor';
import { STANDARD_SYSTEM_INPUTS } from '../../constants';
import { useWorkflow } from '../../context/WorkflowContext';
// import XMarkdownDisplay from './XMarkdownDisplay';

const { Text } = Typography;

const VariableInput = forwardRef(
  (
    {
      value,
      onChange,
      currentNodeId,
      rows,
      placeholder,
      style,
      extra,
      mode = 'input', // 'input' | 'preview'
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const { nodes: actualNodes, edges: actualEdges, getNodeConfig, getNodeLabel } = useWorkflow();

    const { token } = theme.useToken();
    const inputRef = useRef(null);
    const [expanded, setExpanded] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const [searchVar, setSearchVar] = useState('');
    const containerRef = useRef(null);

    // Mention state
    const [mentionVisible, setMentionVisible] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');
    const [mentionCursorPos, setMentionCursorPos] = useState(-1);

    // Draggable Modal Logic
    const [disabled, setDisabled] = useState(true);
    const [bounds, setBounds] = useState({ left: 0, top: 0, bottom: 0, right: 0 });
    const draggleRef = useRef(null);

    const onStart = (_event, uiData) => {
      const { clientWidth, clientHeight } = window.document.documentElement;
      const targetRect = draggleRef.current?.getBoundingClientRect();
      if (!targetRect) return;
      setBounds({
        left: -targetRect.left + uiData.x,
        right: clientWidth - (targetRect.right - uiData.x),
        top: -targetRect.top + uiData.y,
        bottom: clientHeight - (targetRect.bottom - uiData.y),
      });
    };

    const insertText = (textToInsert) => {
      // If we are currently in expanded modal mode, we MUST target the modal's textarea
      if (expanded) {
        const input = document.querySelector('.prompt-studio-editor-textarea');
        if (!input) {
          setTempValue((prev) => (prev || '') + textToInsert);
          return;
        }

        const startPos = input.selectionStart;
        const endPos = input.selectionEnd;
        const currentValue = tempValue || '';
        const scrollTop = input.scrollTop;
        const scrollLeft = input.scrollLeft;

        const newValue =
          currentValue.substring(0, startPos) + textToInsert + currentValue.substring(endPos);

        setTempValue(newValue);

        setTimeout(() => {
          input.focus();
          const newCursorPos = startPos + textToInsert.length;
          input.setSelectionRange(newCursorPos, newCursorPos);
          input.scrollTop = scrollTop;
          input.scrollLeft = scrollLeft;
        }, 0);
        return;
      }

      // If we are not expanded, update current input
      const input = inputRef.current?.resizableTextArea?.textArea || inputRef.current?.input;
      if (!input) {
        // Fallback for preview mode if still used somehow
        if (mode === 'preview') {
          const newValue = (value || '') + textToInsert;
          if (onChange) onChange(newValue);
        }
        return;
      }

      const startPos = input.selectionStart;
      const endPos = input.selectionEnd;
      const currentValue = value || '';

      const newValue =
        currentValue.substring(0, startPos) + textToInsert + currentValue.substring(endPos);

      if (onChange) {
        onChange(newValue);
      }

      setTimeout(() => {
        input.focus();
        const newCursorPos = startPos + textToInsert.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    };

    useImperativeHandle(
      ref,
      () => ({
        insertText,
        focus: () => {
          const target = expanded
            ? document.querySelector('.prompt-studio-editor-textarea')
            : inputRef.current?.resizableTextArea?.textArea || inputRef.current?.input;
          if (target) target.focus();
        },
      }),
      [insertText, expanded],
    );

    const handleSelect = (variableValue) => {
      insertText(variableValue);
    };

    const handleExpandOpen = () => {
      setTempValue(value);
      setExpanded(true);
      setSearchVar('');
    };

    const handleExpandSave = () => {
      if (onChange) onChange(tempValue);
      setExpanded(false);
    };

    const handleMentionSelect = (varValue) => {
      const input = inputRef.current?.resizableTextArea?.textArea || inputRef.current?.input;
      if (!input) {
        setMentionVisible(false);
        return;
      }

      const currentValue = value || '';
      const before = currentValue.substring(0, mentionCursorPos);
      const after = currentValue.substring(input.selectionStart);
      const newValue = before + varValue + after;

      if (onChange) onChange(newValue);
      setMentionVisible(false);

      setTimeout(() => {
        input.focus();
        const newCursorPos = mentionCursorPos + varValue.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    };

    const handleInputChange = (e) => {
      const val = e.target.value;
      if (onChange) onChange(val);

      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = val.substring(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1) {
        // Only trigger if @ is at start or follows a space/newline
        const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
        const isTrigger = charBefore === ' ' || charBefore === '\n' || charBefore === '\t';

        if (isTrigger) {
          const searchPart = textBeforeCursor.substring(lastAtIndex + 1);
          // Only trigger if there are no spaces or newlines between @ and cursor
          if (!searchPart.includes(' ') && !searchPart.includes('\n') && searchPart.length < 20) {
            setMentionVisible(true);
            setMentionSearch(searchPart);
            setMentionCursorPos(lastAtIndex);
            return;
          }
        }
      }
      setMentionVisible(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === '@') {
        // We set a small delay to let the character be inserted if needed,
        // or we just trigger it. In handleInputChange we already detect it.
      }
      if (mentionVisible) {
        if (e.key === 'Escape') {
          setMentionVisible(false);
          e.stopPropagation();
        }
      }
    };

    const availableVariables = useMemo(() => {
      // 如果没有节点数据，返回空
      if (!actualNodes || actualNodes.length === 0) return [];

      const selectedNode = actualNodes.find((n) => n.id === currentNodeId);
      if (!selectedNode) return [];

      const triggerNode = actualNodes.find((n) =>
        [
          'schedule',
          'click',
          'trigger',
          'webhook',
          'dataChange',
          'capability',
          'plugin-trigger',
        ].includes(n.type),
      );

      const vars = [
        {
          label: t('workflow.variables.previousResult', 'Previous Node Result'),
          value: '{{previousNode}}',
          description: t(
            'workflow.variables.previousResultDesc',
            'Result from the immediate predecessor',
          ),
        },
        {
          label: t('workflow.variables.systemDate', 'System: Today (YYYY-MM-DD)'),
          value: '$[date|today]',
          description: t('workflow.variables.systemDateDesc', 'Current local date'),
          isSystem: true,
        },
        {
          label: t('workflow.variables.systemNow', 'System: Now (ISO)'),
          value: '$[date|now]',
          description: t('workflow.variables.systemNowDesc', 'Current timestamp in ISO format'),
          isSystem: true,
        },
        // ...STANDARD_SYSTEM_INPUTS.map(item => ({
        //   label: item.label || item.name,
        //   value: `{{${item.name}}}`,
        //   description: item.description || 'System property',
        //   isSystem: true,
        // })),
      ];

      if (triggerNode && triggerNode.id !== selectedNode.id) {
        vars.push({
          label: `${t('workflow.variables.triggerData', 'Trigger')}: 全部输出`,
          value: `{{${triggerNode.id}}}`,
          description: t('workflow.variables.triggerDataDesc', '完整的触发数据对象'),
          isNode: true,
        });

        const triggerParams = (triggerNode.data?.inputs || []).filter(Boolean);
        triggerParams.forEach((p) => {
          if (!p || !p.name) return;
          vars.push({
            label: `${p.label || p.name}`,
            value: `{{${triggerNode.id}.${p.name}}}`,
            description: `类型: ${(p.type || 'string').toUpperCase()}${p.isSystem ? ' (系统注入)' : ''}`,
            isNode: true,
            isSystem: p.isSystem,
          });
        });
      }

      const nodeVars = [];

      // 💡 排序逻辑：优先使用拓扑排序（连线顺序），如果没有连线数据则回退到 Y 轴排序
      let sortedNodes = [];
      if (actualEdges && actualEdges.length > 0) {
        // 拓扑排序实现
        const nodesMap = new Map(actualNodes.map((n) => [n.id, n]));
        const adjacencyList = new Map();
        const inDegree = new Map();

        actualNodes.forEach((n) => {
          adjacencyList.set(n.id, []);
          inDegree.set(n.id, 0);
        });

        actualEdges.forEach((edge) => {
          if (adjacencyList.has(edge.source) && adjacencyList.has(edge.target)) {
            adjacencyList.get(edge.source).push(edge.target);
            inDegree.set(edge.target, inDegree.get(edge.target) + 1);
          }
        });

        const queue = actualNodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
        const result = [];

        while (queue.length > 0) {
          queue.sort((a, b) => {
            const na = nodesMap.get(a);
            const nb = nodesMap.get(b);
            return (na?.position?.y || 0) - (nb?.position?.y || 0);
          });

          const u = queue.shift();
          result.push(u);

          adjacencyList.get(u).forEach((v) => {
            inDegree.set(v, inDegree.get(v) - 1);
            if (inDegree.get(v) === 0) {
              queue.push(v);
            }
          });
        }

        // 将排序后的 ID 转换回节点对象，并补齐可能因环路等原因缺失的节点
        const sortedIds = new Set(result);
        sortedNodes = result
          .map((id) => nodesMap.get(id))
          .concat(actualNodes.filter((n) => !sortedIds.has(n.id)));
      } else {
        // 回退到 Y 轴排序
        sortedNodes = [...actualNodes].sort((a, b) => {
          const ay = a.position?.y || 0;
          const by = b.position?.y || 0;
          if (ay !== by) return ay - by;
          return (a.position?.x || 0) - (b.position?.x || 0);
        });
      }

      sortedNodes
        .filter((n) => {
          const isCurrent = n.id === currentNodeId;
          const isTrigger = n.id === triggerNode?.id;
          const config = getNodeConfig(n);

          // 真相：如果节点本身记录了是 addon，或者是其对应的原始配置里定义的 addon
          const isAddon =
            n.data?.category === 'addon' ||
            n.data?.isAddon ||
            config?.category === 'addon' ||
            config?.isAddon;
          return !isCurrent && !isTrigger && !isAddon;
        })

        .forEach((n) => {
          const nodeLabel = getNodeLabel(n);
          nodeVars.push({
            label: `${nodeLabel}: 全部输出`,
            value: `{{${n.id}}}`,
            description: t('workflow.variables.nodeResultDesc', '该节点的执行结果对象'),
            isNode: true,
          });

          const config = getNodeConfig(n);
          const dataOutputs = n.data?.outputs || [];

          dataOutputs.forEach((o) => {
            if (!o || !o.name) return;
            nodeVars.push({
              label: `${nodeLabel}: ${o.name}`,
              value: `{{${n.id}.${o.name}}}`,
              description: `类型: ${(o.type || 'string').toUpperCase()}`,
              isNode: true,
            });
          });
        });

      return [...vars, ...nodeVars];
    }, [actualNodes, actualEdges, currentNodeId, t]);

    const filteredVariables = useMemo(() => {
      if (!searchVar) return availableVariables;
      return availableVariables.filter(
        (v) =>
          v.label?.toLowerCase().includes(searchVar.toLowerCase()) ||
          v.value?.toLowerCase().includes(searchVar.toLowerCase()),
      );
    }, [availableVariables, searchVar]);

    const mentionItems = useMemo(() => {
      const filtered = availableVariables.filter(
        (v) =>
          !mentionSearch ||
          v.label?.toLowerCase().includes(mentionSearch.toLowerCase()) ||
          v.value?.toLowerCase().includes(mentionSearch.toLowerCase()),
      );
      return filtered.slice(0, 15).map((v) => ({
        key: v.value,
        label: (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 150 }}>
            <Text strong style={{ fontSize: 13 }}>
              {v.label}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {v.value}
            </Text>
          </div>
        ),
        onClick: () => handleMentionSelect(v.value),
      }));
    }, [availableVariables, mentionSearch, handleMentionSelect]);

    // 💡 将扁平变量列表转换为树形结构（精简分类版）
    const variableTree = useMemo(() => {
      const tree = [];
      const map = {};

      // 预设的一级分类
      const getCategory = (v, path) => {
        if (v.isNode || path.startsWith('nodes.')) return '节点树';
        return '全局变量';
      };

      filteredVariables.forEach((v) => {
        const path = v.value.replace(/[{}]/g, '').trim();
        const category = getCategory(v, path);

        if (!map[category]) {
          const catNode = {
            title: (
              <Text strong style={{ color: token.colorPrimary, fontSize: 12 }}>
                {category}
              </Text>
            ),
            key: `cat-${category}`,
            children: [],
            selectable: false,
          };
          map[category] = catNode;
          tree.push(catNode);
        }

        const parts = path.split('.');
        let currentLevel = map[category].children;
        let currentPath = category;

        parts.forEach((part, index) => {
          currentPath += `.${part}`;
          const isLeaf = index === parts.length - 1;

          if (!map[currentPath]) {
            const newNode = {
              title: isLeaf ? (
                <div style={{ padding: '2px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Badge
                      color={v.isSystem ? token.colorWarning : token.colorInfo}
                      style={{ zoom: 0.8 }}
                    />
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>
                      {v.label || part}
                      {v.isSystem && (
                        <Text
                          type="secondary"
                          style={{ fontSize: 10, fontWeight: 'normal', marginLeft: 4 }}
                        >
                          (system)
                        </Text>
                      )}
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 10, marginLeft: 12, display: 'block' }}>
                    {v.value}
                  </Text>
                </div>
              ) : (
                <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {part.toUpperCase()}
                </Text>
              ),
              key: isLeaf ? v.value : `folder-${currentPath}`,
              isLeaf,
              children: [],
              selectable: isLeaf,
            };
            map[currentPath] = newNode;
            currentLevel.push(newNode);
          }
          currentLevel = map[currentPath].children;
        });
      });

      return tree;
    }, [filteredVariables, token]);

    const renderContent = () => {
      const actionsNode = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <VariableSelector variables={availableVariables} onSelect={handleSelect} />
          {extra}
          {rows && (
            <Tooltip title={t('common.expand', 'Expand')}>
              <Button
                type="text"
                size="small"
                icon={
                  <ExpandAltOutlined style={{ fontSize: 14, color: token.colorTextDescription }} />
                }
                onClick={handleExpandOpen}
                style={{
                  background: token.colorFillAlter,
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>
          )}
        </div>
      );

      return (
        <Dropdown
          open={mentionVisible}
          onOpenChange={setMentionVisible}
          menu={{ items: mentionItems }}
          trigger={[]}
          placement="bottomLeft"
          getPopupContainer={() => containerRef.current || document.body}
          overlayStyle={{ zIndex: 2000 }} // Ensure it's above modals if needed
        >
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              ...style,
            }}
          >
            {rows ? (
              <Input.TextArea
                ref={inputRef}
                value={value || ''}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={rows}
                placeholder={placeholder}
                style={{ width: '100%', paddingRight: rows ? 40 : 0 }}
                {...props}
              />
            ) : (
              <Input
                ref={inputRef}
                value={value || ''}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                style={{ width: '100%' }}
                suffix={actionsNode}
                {...props}
              />
            )}
            {rows && (
              <div
                style={{
                  position: 'absolute',
                  right: 8,
                  bottom: rows == 1 ? 0 : 8,
                  zIndex: 2,
                }}
              >
                {actionsNode}
              </div>
            )}
          </div>
        </Dropdown>
      );
    };

    return (
      <>
        {renderContent()}
        <Modal
          open={expanded}
          title={
            <div
              className="draggable-modal-title"
              style={{ width: '100%', cursor: 'move', userSelect: 'none' }}
            >
              <Space style={{ width: '100%' }}>
                <CodeOutlined style={{ color: token.colorPrimary }} />
                <span>{placeholder || t('workflow.designer.promptEditor', 'Prompt Editor')}</span>
              </Space>
            </div>
          }
          onCancel={() => setExpanded(false)}
          onOk={handleExpandSave}
          width={1000}
          centered
          modalRender={(modal) => (
            <Draggable
              handle=".ant-modal-header" // Target the Ant Design header specifically
              bounds={bounds}
              nodeRef={draggleRef}
              onStart={(event, uiData) => onStart(event, uiData)}
            >
              <div ref={draggleRef}>{modal}</div>
            </Draggable>
          )}
          destroyOnClose
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          styles={{ body: { padding: 0 } }}
        >
          <div
            style={{
              display: 'flex',
              height: '600px',
              borderTop: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            {/* 1. Variable Sidebar (Left) */}
            <div
              style={{
                width: 280,
                borderRight: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorFillAlter,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '16px 12px',
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  <BlockOutlined style={{ marginRight: 8 }} />
                  {t('workflow.nodes.nodes', 'Variables & Nodes')}
                </Text>
                <Input
                  prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
                  placeholder={t('common.search', 'Search...')}
                  size="small"
                  value={searchVar}
                  onChange={(e) => setSearchVar(e.target.value)}
                  allowClear
                />
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {variableTree.length > 0 ? (
                  <Tree
                    treeData={variableTree}
                    onSelect={(selectedKeys) => {
                      if (selectedKeys.length > 0 && !selectedKeys[0].startsWith('folder-')) {
                        handleSelect(selectedKeys[0]);
                      }
                    }}
                    blockNode
                    showLine={{ showLeafIcon: false }}
                    defaultExpandAll
                    style={{ background: 'transparent' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <Text type="secondary">{t('common.noData', 'No Variables')}</Text>
                  </div>
                )}
              </div>

              <div style={{ padding: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t(
                    'workflow.designer.variableTip',
                    'Click variable to insert into prompt at cursor position.',
                  )}
                </Text>
              </div>
            </div>

            {/* 2. Editor Area (Right) */}
            <div
              style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Text type="secondary" size="small">
                  {t('workflow.designer.editorMode', 'Editor Mode: Monospace & Markdown')}
                </Text>
                <Space>{extra}</Space>
              </div>

              <VariableMarkdownEditor
                value={tempValue}
                onChange={setTempValue}
                placeholder={placeholder}
                style={{ height: '100%' }}
              />
            </div>
          </div>
        </Modal>
      </>
    );
  },
);

export default VariableInput;
