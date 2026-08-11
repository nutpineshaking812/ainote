import ScheduleNode from './views/ScheduleNode';
import NotificationNode from './views/NotificationNode';
import ClickNode from './views/ClickNode';
import LogNode from './views/LogNode';
import WebhookNode from './views/WebhookNode';
import DataChangeNode from './views/DataChangeNode';
import AIAgentNode from './views/AIAgentNode';
import WaitUpdateNode from './views/WaitUpdateNode';
import IfNode from './views/IfNode';
import WhileNode from './views/WhileNode';
import ForNode from './views/ForNode';
import FetchResourceNode from './views/FetchResourceNode';
import DingTalkRobotNode from './views/DingTalkRobotNode';
import CapabilityTriggerNode from './views/CapabilityTriggerNode';
import SkillActionNode from './views/SkillActionNode';
import SkillNode from './views/SkillNode';
import FetchMemoryNode from './views/FetchMemoryNode';
import RecallKnowledgeNode from './views/RecallKnowledgeNode';

import EndNode from './views/EndNode';
import PluginNode from './views/PluginNode';

import {
  VectorIndexNode,
  VectorSearchNode,
  FetchMemorySectionNode,
  UpsertMemorySectionNode,
  GetExecutionLogsNode,
  GetMemoryHeadersNode,
} from './views/MemoryNodes';

import ConversationNode from './views/ConversationNode';
import ConversationProperties from './properties/ConversationProperties';
import MemoryProperties from './properties/MemoryProperties';

import ScheduleProperties from './properties/ScheduleProperties';
import NotificationProperties from './properties/NotificationProperties';
import ClickProperties from './properties/ClickProperties';
import LogProperties from './properties/LogProperties';
import WebhookProperties from './properties/WebhookProperties';
import DataChangeProperties from './properties/DataChangeProperties';
import AIAgentProperties from './properties/AIAgentProperties';
import WaitUpdateProperties from './properties/WaitUpdateProperties';
import IfProperties from './properties/IfProperties';
import WhileProperties from './properties/WhileProperties';
import ForProperties from './properties/ForProperties';
import FetchResourceProperties from './properties/FetchResourceProperties';
import DingTalkRobotProperties from './properties/DingTalkRobotProperties';
import CapabilityTriggerProperties from './properties/CapabilityTriggerProperties';
import SkillActionProperties from './properties/SkillActionProperties';
import SkillNodeProperties from './properties/SkillNodeProperties';
import RecallKnowledgeProperties from './properties/RecallKnowledgeProperties';
import EndProperties from './properties/EndProperties';
import PluginProperties from './properties/PluginProperties';

import {
  VectorIndexProperties,
  VectorSearchProperties,
  FetchMemorySectionProperties,
  UpsertMemorySectionProperties,
  GetExecutionLogsProperties,
  GetMemoryHeadersProperties,
} from './properties/MemoryNodeProperties';


import { NODE_ICONS, STANDARD_SYSTEM_INPUTS } from '../constants';

export const NODE_REGISTRY = {
  schedule: {
    type: 'schedule',
    label: 'workflow.nodes.schedule.title',
    desc: 'workflow.nodes.schedule.desc',
    node: ScheduleNode,
    properties: ScheduleProperties,
    initialData: {
      cron: '0 9 * * *',
      inputs: [...STANDARD_SYSTEM_INPUTS],
    },
  },
  notification: {
    type: 'notification',
    label: 'workflow.nodes.notification.title',
    desc: 'workflow.nodes.notification.desc',
    node: NotificationNode,
    properties: NotificationProperties,
    initialData: { title: 'New Notification', content: '' },
  },
  click: {
    type: 'click',
    label: 'workflow.nodes.click.title',
    desc: 'workflow.nodes.click.desc',
    node: ClickNode,
    properties: ClickProperties,
    initialData: {
      inputs: [...STANDARD_SYSTEM_INPUTS],
    },
  },

  log: {
    type: 'log',
    label: 'workflow.nodes.log.title',
    desc: 'workflow.nodes.log.desc',
    node: LogNode,
    properties: LogProperties,
    initialData: { message: '{{previousNode}}' },
  },
  webhook: {
    type: 'webhook',
    label: 'workflow.nodes.webhook.title',
    desc: 'workflow.nodes.webhook.desc',
    node: WebhookNode,
    properties: WebhookProperties,
    initialData: {
      secret: '',
      inputs: [...STANDARD_SYSTEM_INPUTS],
    },
    outputs: {
      body: { type: 'object', description: 'HTTP Request Body' },
      query: { type: 'object', description: 'URL Query Params' },
      headers: { type: 'object', description: 'HTTP Headers' },
    },
  },
  dataChange: {
    type: 'dataChange',
    label: 'workflow.nodes.dataChange.title',
    desc: 'workflow.nodes.dataChange.desc',
    node: DataChangeNode,
    properties: DataChangeProperties,
    initialData: {
      formId: '',
      event: 'update',
      inputs: [...STANDARD_SYSTEM_INPUTS],
    },
  },
  aiAgent: {
    type: 'aiAgent',
    connectionRules: {
      allowFromHandle: {
        'tool-slot': ['skillNode'],
        'knowledge-slot': ['recallKnowledge'],
        'memory-slot': ['fetchMemory'],
      },
    },
    node: AIAgentNode,
    label: 'workflow.nodes.aiAgent.title',
    desc: 'workflow.nodes.aiAgent.desc',
    properties: AIAgentProperties,
    initialData: { prompt: '', model: 'gpt-4o', toolChoice: 'auto' },
    inputs: {
      prompt: { type: 'string', required: true, label: '系统提示词' },
      userPrompt: { type: 'string', required: true, label: '用户指令' },
      model: { type: 'string', label: '模型' },
    },
    outputs: {
      rawContent: { type: 'string', label: '回复内容' },
      usage: { type: 'object', label: '消耗详情' },
    },
  },
  waitUpdate: {
    type: 'waitUpdate',
    label: 'workflow.nodes.waitUpdate.title',
    desc: 'workflow.nodes.waitUpdate.desc',
    node: WaitUpdateNode,
    properties: WaitUpdateProperties,
    initialData: { formId: '', timeout: 3600 },
  },
  if: {
    type: 'if',
    label: 'workflow.nodes.if.title',
    desc: 'workflow.nodes.if.desc',
    category: 'logic',
    node: IfNode,
    properties: IfProperties,
    initialData: { condition: '{{previous.status}} === 200' },
  },
  while: {
    type: 'while',
    label: 'workflow.nodes.while.title',
    desc: 'workflow.nodes.while.desc',
    category: 'logic',
    node: WhileNode,
    properties: WhileProperties,
    initialData: { condition: '{{previous.data.length}} > 0' },
  },
  for: {
    type: 'for',
    label: 'workflow.nodes.for.title',
    desc: 'workflow.nodes.for.desc',
    category: 'logic',
    node: ForNode,
    properties: ForProperties,
    initialData: { limit: 10, iterator: '' },
  },
  fetchResource: {
    type: 'fetchResource',
    label: 'workflow.nodes.fetchResource.title',
    desc: 'workflow.nodes.fetchResource.desc',
    node: FetchResourceNode,
    properties: FetchResourceProperties,
    initialData: { groups: [{ type: 'all' }] },
  },
  dingTalkRobot: {
    type: 'dingTalkRobot',
    label: 'workflow.nodes.dingTalkRobot.title',
    desc: 'workflow.nodes.dingTalkRobot.desc',
    node: DingTalkRobotNode,
    properties: DingTalkRobotProperties,
    initialData: { webhook: '', secret: '', msgType: 'text', content: '' },
  },
  capability: {
    type: 'capability',
    label: 'workflow.nodes.capability.title',
    desc: 'workflow.nodes.capability.desc',
    node: CapabilityTriggerNode,
    properties: CapabilityTriggerProperties,
    initialData: {
      matchTags: [],
      inputs: [...STANDARD_SYSTEM_INPUTS],
    },
    outputs: {
      message: { type: 'string', description: 'User input text' },
      skillIds: { type: 'array', description: 'Detected skills' },
      // conversationId: { type: 'string' },
    },
  },
  end: {
    type: 'end',
    category: 'logic',
    label: 'workflow.nodes.end.title',
    desc: 'workflow.nodes.end.desc',
    node: EndNode,
    properties: EndProperties,
    initialData: {
      label: '结束并输出 (End)',
      outputs: [{ name: 'result', type: 'string', value: '{{previous.result}}' }],
    },
  },
  skillAction: {
    type: 'skillAction',
    label: 'workflow.nodes.skillAction.title',
    desc: 'workflow.nodes.skillAction.desc',
    node: SkillActionNode,
    properties: SkillActionProperties,
    initialData: { action: 'install', gitUrl: '' },
  },
  skillNode: {
    type: 'skillNode',
    label: 'workflow.nodes.skillNode.title',
    desc: 'workflow.nodes.skillNode.desc',
    category: 'addon',
    connectionRules: {
      allowAsTarget: [{ nodeType: 'aiAgent', sourceHandleId: 'tool-slot' }],
    },
    node: SkillNode,
    properties: SkillNodeProperties,
    initialData: { skillIds: [] },
  },
  ensureConvo: {
    type: 'ensureConvo',
    label: 'workflow.nodes.ensureConvo.title',
    desc: 'workflow.nodes.ensureConvo.desc',
    node: PluginNode,
    properties: PluginProperties,
    initialData: {
      label: 'Ensure Conversation',
      pluginId: 'ensureConvo',
      pluginParams: {
        conversationId: '{{trigger.sessionId}}',
        scenario: 'GENERAL',
      },
    },
    outputs: {
      conversationId: { type: 'string', description: 'Internal session identifier' },
      title: { type: 'string', description: 'Conversation title' },
      type: { type: 'string', description: 'Conversation category' },
      createdAt: { type: 'string', description: 'Creation timestamp' },
      isNew: { type: 'boolean', description: 'Whether a new conversation was created' },
    },
  },
  addMessage: {
    type: 'addMessage',
    label: 'workflow.nodes.addMessage.title',
    desc: 'workflow.nodes.addMessage.desc',
    node: ConversationNode,
    properties: ConversationProperties,
    initialData: {
      label: 'Add Message',
      role: 'user',
      content: '{{trigger.message}}',
      openBubble: false,
    },
  },
  fetchMemory: {
    type: 'fetchMemory',
    label: 'workflow.nodes.fetchMemory.title',
    desc: 'workflow.nodes.fetchMemory.desc',
    category: 'addon',
    connectionRules: {
      allowAsTarget: [{ nodeType: 'aiAgent', sourceHandleId: 'memory-slot' }],
    },
    node: FetchMemoryNode,
    properties: MemoryProperties,
    initialData: { label: '获取历史消息', limit: 10 },
    inputs: {
      conversationId: { type: 'string', description: 'Target session ID' },
      limit: { type: 'number', description: 'Max messages to fetch' },
      afterTime: { type: 'string', description: 'Filter messages after this time' },
    },
    outputs: {
      messages: { type: 'array', description: 'Original message objects' },
      count: { type: 'number', description: 'Actual number of messages fetched' },
      plainText: { type: 'string', description: 'Formatted conversation text' },
      latestMessageTime: { type: 'string', description: 'Timestamp of the newest message' },
    },
  },
  loadMemory: {
    type: 'loadMemory',
    label: 'workflow.nodes.loadMemory.title',
    desc: 'workflow.nodes.loadMemory.desc',
    node: ConversationNode,
    properties: MemoryProperties,
    initialData: { label: '获取历史消息', limit: 10 },
    inputs: {
      conversationId: { type: 'string', description: 'Target session ID' },
      limit: { type: 'number', description: 'Max messages to fetch' },
      afterTime: { type: 'string', description: 'Filter messages after this time' },
    },
    outputs: {
      messages: { type: 'array', description: 'Original message objects' },
      count: { type: 'number', description: 'Actual number of messages fetched' },
      plainText: { type: 'string', description: 'Formatted conversation text' },
    },
  },
  sendSseEvent: {
    type: 'sendSseEvent',
    label: 'workflow.nodes.sendSseEvent.title',
    desc: 'workflow.nodes.sendSseEvent.desc',
    node: ConversationNode,
    properties: ConversationProperties,
    initialData: { label: 'Send Signal', status: 'thinking' },
  },
  buildAnalysisQuery: {
    type: 'buildAnalysisQuery',
    label: 'workflow.nodes.buildAnalysisQuery.title',
    desc: 'workflow.nodes.buildAnalysisQuery.desc',
    category: 'specialized',
    node: ConversationNode,
    properties: ConversationProperties,
    initialData: { label: 'Build Query' },
  },
  mongoAggregate: {
    type: 'mongoAggregate',
    label: 'workflow.nodes.mongoAggregate.title',
    desc: 'workflow.nodes.mongoAggregate.desc',
    category: 'specialized',
    node: ConversationNode,
    properties: ConversationProperties,
    initialData: { label: 'Execute Query' },
  },

  // ── Recall Knowledge (Long-term Memory Addon) ────────────────
  recallKnowledge: {
    type: 'recallKnowledge',
    label: 'workflow.nodes.recallKnowledge.title',
    desc: 'workflow.nodes.recallKnowledge.desc',
    category: 'addon',
    connectionRules: {
      allowAsTarget: [{ nodeType: 'aiAgent', sourceHandleId: 'knowledge-slot' }],
    },
    node: RecallKnowledgeNode,
    properties: RecallKnowledgeProperties,
    initialData: { label: '加载知识', workflowId: '' },
  },
  // ── Memory Atomic Nodes ────────────────────────────────────────
  vectorIndex: {
    type: 'vectorIndex',
    category: 'memory',
    label: 'workflow.nodes.vectorIndex.title',
    desc: 'workflow.nodes.vectorIndex.desc',
    node: VectorIndexNode,
    properties: VectorIndexProperties,
    initialData: { label: 'Vector Index', content: '' },
  },
  vectorSearch: {
    type: 'vectorSearch',
    category: 'memory',
    label: 'workflow.nodes.vectorSearch.title',
    desc: 'workflow.nodes.vectorSearch.desc',
    node: VectorSearchNode,
    properties: VectorSearchProperties,
    initialData: { label: 'Vector Search', query: '', limit: 5 },
    outputs: {
      results: { type: 'array', description: 'Search results' },
    },
  },
  fetchMemorySection: {
    type: 'fetchMemorySection',
    label: 'workflow.nodes.fetchMemorySection.title',
    desc: 'workflow.nodes.fetchMemorySection.desc',
    category: 'memory',
    node: FetchMemorySectionNode,
    properties: FetchMemorySectionProperties,
    initialData: { label: 'Fetch Memory Section', sessionId: '', section: '' },
    outputs: {
      content: { type: 'string', description: 'Section content' },
    },
  },
  upsertMemorySection: {
    type: 'upsertMemorySection',
    label: 'workflow.nodes.upsertMemorySection.title',
    desc: 'workflow.nodes.upsertMemorySection.desc',
    node: UpsertMemorySectionNode,
    properties: UpsertMemorySectionProperties,
    initialData: {
      label: '更新记忆段落',
      documentId: '',
      sectionHeader: '## 业务事实',
      content: '',
    },
  },
  getExecutionLogs: {
    type: 'getExecutionLogs',
    label: 'workflow.nodes.getExecutionLogs.title',
    desc: 'workflow.nodes.getExecutionLogs.desc',
    node: GetExecutionLogsNode,
    properties: GetExecutionLogsProperties,
    initialData: { label: '获取执行记录', limit: 5, status: 'SUCCESS' },
  },
  getMemoryHeaders: {
    type: 'getMemoryHeaders',
    label: 'workflow.nodes.getMemoryHeaders.title',
    desc: 'workflow.nodes.getMemoryHeaders.desc',
    node: GetMemoryHeadersNode,
    properties: GetMemoryHeadersProperties,
    initialData: { label: '获取知识大纲', category: '' },
  },
  // ── User Personal Variables (Cloud Properties) ──────────────
  // Fallback compatibility registry mapping to generic Plugin components
  readUserProperty: {
    type: 'readUserProperty',
    category: 'variables',
    label: 'workflow.nodes.readUserProperty.title',
    desc: 'workflow.nodes.readUserProperty.desc',
    node: PluginNode,
    properties: PluginProperties,
    initialData: { label: '读取个人变量', pluginId: 'readUserProperty', pluginParams: { defaultValue: '0' } },
  },
  writeUserProperty: {
    type: 'writeUserProperty',
    category: 'variables',
    label: 'workflow.nodes.writeUserProperty.title',
    desc: 'workflow.nodes.writeUserProperty.desc',
    node: PluginNode,
    properties: PluginProperties,
    initialData: { label: '写入个人变量', pluginId: 'writeUserProperty', pluginParams: { strategy: 'overwrite' } },
  },
  'plugin-action': {
    type: 'plugin-action',
    category: 'plugin',
    node: PluginNode,
    properties: PluginProperties,
    initialData: { pluginId: '', pluginParams: {} },
    outputs: {
      result: { type: 'object', label: 'Plugin Result' },
    },
  },
  'plugin-trigger': {
    type: 'plugin-trigger',
    category: 'trigger',
    node: PluginNode,
    properties: PluginProperties,
    initialData: {
      pluginId: '',
      pluginParams: {},
      inputs: [...STANDARD_SYSTEM_INPUTS],
    },
    outputs: {
      query: { type: 'string', description: 'User input text' },
      senderId: { type: 'string', description: 'DingTalk Sender ID' },
      conversationId: { type: 'string' },
    },
  },
};
