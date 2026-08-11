import React from 'react';
import { Input, InputNumber, Switch } from 'antd';
import KnowledgeSetSelector from './KnowledgeSetSelector';
import KnowledgeDocSelector from './KnowledgeDocSelector';
import LLMModelSelector from './LLMModelSelector';
import SkillSelector from './SkillSelector';
import SkillSelectorSingle from './SkillSelectorSingle';
import ResourceFolderSelector from './ResourceFolderSelector';
import CollisionStrategySelector from './CollisionStrategySelector';
import VariableInput from './VariableInput';
import WorkflowSelector from './WorkflowSelector';
import FormSelector from './FormSelector';
import DateFilterSelector from './DateFilterSelector';
import SubworkflowParamsEditor from './SubworkflowParamsEditor';
import DigitalEmployeeSelector from './DigitalEmployeeSelector';
import SwitchCasesEditor from './SwitchCasesEditor';
import VariableDatePicker from './VariableDatePicker';
import VariableJavaScriptEditor from './VariableJavaScriptEditor';
import CurlImport from './CurlImport';
import WorkspacePathInput from './WorkspacePathInput';

/**
 * 💡 统一属性输入组件注册表 (支持常用别名映射以实现向后兼容)
 * 适用于：插件属性 (PluginProperties)、工作流动态字段 (WorkflowFieldRenderer)、数字员工配置
 */
const baseRegistry = {
  // 核心工作空间组件
  workspacePath: WorkspacePathInput,

  // 业务组件
  knowledge: (props) => <KnowledgeSetSelector mode="multiple" {...props} />,
  knowledgeDocs: KnowledgeDocSelector,
  model: LLMModelSelector,
  skills: SkillSelector,
  skillSelectorSingle: SkillSelectorSingle,
  folder: ResourceFolderSelector,
  collisionStrategy: CollisionStrategySelector,
  variableInput: VariableInput,
  prompt: (props) => <VariableInput rows={4} mode="preview" {...props} />,

  // 子工作流插件专用输入组件
  workflowSelector: WorkflowSelector,
  subworkflowParams: SubworkflowParamsEditor,

  // 数据表单选择组件
  formSelector: FormSelector,

  // 邮件相对日期过滤器
  dateFilterSelector: DateFilterSelector,

  // 数字员工选择组件
  digitalEmployeeSelector: DigitalEmployeeSelector,

  // Switch 匹配插件输入组件
  switchCases: SwitchCasesEditor,

  // 基础类型映射
  string: Input,
  number: InputNumber,
  boolean: Switch,
  textarea: (props) => <Input.TextArea rows={4} {...props} />,
  date: VariableDatePicker,

  // 自定义 JavaScript 代码编辑器组件
  javascript: VariableJavaScriptEditor,

  // cURL 命令行导入组件
  curlImport: CurlImport,
};

export const PROPERTY_INPUTS_REGISTRY = {
  ...baseRegistry,

  // 兼容性别名映射
  knowledgeSetIds: baseRegistry.knowledge,
  knowledgeIds: baseRegistry.knowledgeDocs,
  skillIds: baseRegistry.skills,
  systemPrompt: baseRegistry.prompt,
  switch: baseRegistry.boolean,
  datePicker: baseRegistry.date,
  code: baseRegistry.javascript,
};

// 💡 属性组件中文友好名称标签映射，供高级参数编辑器等列表做可读性展示
export const PROPERTY_INPUT_LABELS = {
  string: '文本 (String)',
  number: '数字 (Number)',
  boolean: '开关 (Boolean)',
  textarea: '多行文本 (Textarea)',
  date: '日期时间 (Date)',
  javascript: 'JavaScript 脚本',
  workspacePath: '本地工作空间',
  knowledge: '关联知识库',
  knowledgeDocs: '参考文档列表',
  model: 'LLM 模型选择',
  skills: '绑定的技能列表',
  skillSelectorSingle: '单技能选择',
  folder: '资源目录选择',
  collisionStrategy: '冲突解决策略',
  variableInput: '变量输入框',
  prompt: '系统提示词编辑器',
  workflowSelector: '工作流选择',
  subworkflowParams: '工作流参数配置',
  formSelector: '数据表单选择',
  dateFilterSelector: '相对日期过滤',
  digitalEmployeeSelector: '数字员工选择',
  switchCases: '分支条件编辑器',
  curlImport: 'cURL 命令行导入',
  array: '数组 (Array)',
  object: '对象 (Object)'
};
