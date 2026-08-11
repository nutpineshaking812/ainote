import DigitalEmployeeRepository from '../repositories/digitalEmployee.repository.js';
import { ApiError } from '../utils/ApiError.js';
import workflowService from './workflow.service.js';
import presetEmployees from '../registry/digital-employees/index.js';
import registryService from './workflow/registry.service.js';
import appService from './app.service.js';
import { getTemporalClient } from '../temporal/client.js';
import env from '../config/env.js';
import { UnifiedChatService } from './ai/UnifiedChatService.js';
import { EMPLOYEE_SCENARIOS, EMPLOYEE_SCENARIO_LIST } from '../constants/digitalEmployee.js';

/**
 * 数字员工 Service
 */

const getEmployees = async (appId, scenario) => {
  return DigitalEmployeeRepository.findByApp(appId, scenario);
};

const getEmployeeById = async (id) => {
  const employee = await DigitalEmployeeRepository.findById(id);
  if (!employee) {
    throw ApiError.notFound('Digital employee not found', 'DE_NOT_FOUND');
  }

  const result = employee.toObject ? employee.toObject() : { ...employee };

  // 优化：如果存在工作流，顺便把 trigger 节点的输入定义查出来，减少前端调用
  if (employee.workflowId) {
    try {
      // 修复：获取应用信息以拿到 organizationId，否则 workflowService 校验会失败
      const app = await appService.getApplicationById(employee.appRef);
      const organizationId = app.organizationId?.toString();

      const workflow = await workflowService.getWorkflowById(organizationId, employee.workflowId);
      if (workflow && Array.isArray(workflow.nodes)) {
        // 查找触发器节点（能力、点击、触发等）
        const triggerNode = workflow.nodes.find((n) =>
          [
            'capability',
            'click',
            'trigger',
            'webhook',
            'dataChange',
            'schedule',
            'plugin-trigger',
          ].includes(n.type),
        );
        if (triggerNode) {
          const rawSchema = triggerNode.data?.inputs || triggerNode.data?.params || [];
          // 显式确保 isSystem 等核心标识被保留
          result.workflowSchema = rawSchema.map((item) => ({
            ...item,
          }));
        }
      }
    } catch (err) {
      console.warn(
        `[DigitalEmployeeService] Failed to load workflow schema for ${employee.workflowId}:`,
        err.message,
      );
    }
  }

  return result;
};

/**
 * 创建数字员工
 * 显式定义字段，避免“黑盒”传递 body
 */
const createEmployee = async (
  appId,
  { name, roleTitle, avatar, description, scenario, workflowId, metadata, isActive },
  userId,
) => {
  const incomingRole = roleTitle || metadata?.roleKey || '';
  const resolvedRole = (incomingRole || '').trim().toLowerCase();
  const finalScenario = scenario || EMPLOYEE_SCENARIOS.GENERAL;

  let finalConfig = null;
  let finalWorkflowTemplate = null;
  let templateKeyUsed = 'DIGITAL_EMPLOYEE';

  // 【成对组件包搜寻】：config.js 与 workflow.json 是一对高度内聚相互配合的组件包，我们以小写目录规范成对装载！
  if (resolvedRole) {
    try {
      const fs = await import('fs');
      const path = await import('path');

      const lowerRoleKey = resolvedRole.toLowerCase();
      const lowerScenario = finalScenario.toLowerCase();

      let resolvedConfigPath = null;
      let resolvedWorkflowPath = null;

      // 1. 尝试定位到特定场景的 config.js 及其 workflow.json
      const scenarioConfigPath = path.join(
        process.cwd(),
        'registry/digital-employees',
        lowerRoleKey,
        lowerScenario,
        'config.js',
      );
      const scenarioWorkflowPath = path.join(
        process.cwd(),
        'registry/digital-employees',
        lowerRoleKey,
        lowerScenario,
        'workflow.json',
      );

      // 2. 尝试定位到角色根目录下的默认 config.js 及 workflow.json
      const defaultRoleConfigPath = path.join(
        process.cwd(),
        'registry/digital-employees',
        lowerRoleKey,
        'config.js',
      );
      const defaultRoleWorkflowPath = path.join(
        process.cwd(),
        'registry/digital-employees',
        lowerRoleKey,
        'workflow.json',
      );

      if (fs.existsSync(scenarioConfigPath)) {
        resolvedConfigPath = scenarioConfigPath;
        console.log(
          `[CreateEmployee] 🎯 找到特定场景配置: ${lowerRoleKey}/${lowerScenario}/config.js`,
        );
        if (fs.existsSync(scenarioWorkflowPath)) {
          resolvedWorkflowPath = scenarioWorkflowPath;
          console.log(
            `[CreateEmployee] 🎯 找到同级特定场景流程: ${lowerRoleKey}/${lowerScenario}/workflow.json`,
          );
        } else if (fs.existsSync(defaultRoleWorkflowPath)) {
          resolvedWorkflowPath = defaultRoleWorkflowPath;
          console.log(
            `[CreateEmployee] 🎯 特定场景流程未找到，使用该角色默认流程: ${lowerRoleKey}/workflow.json`,
          );
        }
      } else if (fs.existsSync(defaultRoleConfigPath)) {
        resolvedConfigPath = defaultRoleConfigPath;
        console.log(
          `[CreateEmployee] 🎯 特定场景配置不存在，使用该角色默认配置: ${lowerRoleKey}/config.js`,
        );
        if (fs.existsSync(defaultRoleWorkflowPath)) {
          resolvedWorkflowPath = defaultRoleWorkflowPath;
          console.log(`[CreateEmployee] 🎯 找到同级角色默认流程: ${lowerRoleKey}/workflow.json`);
        }
      } else {
        console.log(
          `[CreateEmployee] ⚠️ 角色 [${lowerRoleKey}] 的配置在场景 [${lowerScenario}] 及根目录中均未找到`,
        );
        if (fs.existsSync(defaultRoleWorkflowPath)) {
          resolvedWorkflowPath = defaultRoleWorkflowPath;
          console.log(
            `[CreateEmployee] 🎯 虽无配置，但找到并采用该角色默认流程: ${lowerRoleKey}/workflow.json`,
          );
        }
      }

      // 加载配置
      if (resolvedConfigPath) {
        const isScenarioConfig = resolvedConfigPath.includes(
          path.join(lowerRoleKey, lowerScenario),
        );
        const relativePath = isScenarioConfig
          ? `../registry/digital-employees/${lowerRoleKey}/${lowerScenario}/config.js`
          : `../registry/digital-employees/${lowerRoleKey}/config.js`;

        const roleConfigModule = await import(relativePath);
        finalConfig = roleConfigModule.default;
      }

      // 加载流程
      if (resolvedWorkflowPath) {
        const rawData = fs.readFileSync(resolvedWorkflowPath, 'utf8');
        finalWorkflowTemplate = JSON.parse(rawData);
        const isScenarioWorkflow = resolvedWorkflowPath.includes(
          path.join(lowerRoleKey, lowerScenario),
        );
        const templateSuffix = isScenarioWorkflow ? lowerScenario.toUpperCase() : 'DEFAULT';
        templateKeyUsed = `ROLE_${resolvedRole.toUpperCase()}_${templateSuffix}`;
      }
    } catch (err) {
      console.error(`[CreateEmployee] ⚠️ 物理组件包载入过程中发生错误:`, err);
    }
  }

  // 深度参数补全以最终装载的组件 config 为准！
  let finalName = name;
  let finalRoleTitle = resolvedRole || roleTitle;
  let finalAvatar = avatar;
  let finalDescription = description;
  let finalMetadata = metadata || {};

  if (finalConfig) {
    console.log(`[CreateEmployee] 🎯 成功应用预设组件配置，执行参数深度合并补全！`);
    finalName = name || finalConfig.name;
    finalRoleTitle = resolvedRole || roleTitle || finalConfig.roleTitle;
    finalAvatar = avatar || finalConfig.avatar;
    finalDescription = description || finalConfig.description;

    // console.log('createEmployee====', finalConfig.metadata, metadata, resolvedRole);
    finalMetadata = {
      ...finalConfig.metadata,
      ...(metadata || {}),
      roleKey: resolvedRole,
    };
  }

  if (!finalName) {
    throw ApiError.badRequest('名称是必填项', 'DE_REQUIRED_FIELDS');
  }

  // 场景校验
  if (scenario && !EMPLOYEE_SCENARIO_LIST.includes(scenario)) {
    throw ApiError.badRequest('无效的使用场景', 'DE_INVALID_SCENARIO');
  }

  // 获取应用信息以拿到 organizationId
  const app = await appService.getApplicationById(appId);
  const organizationId = app.organizationId.toString();

  let finalWorkflowId = workflowId;

  // 如果没有提供 workflowId，按照“级联命名匹配规则”加载或克隆专属的大脑工作流
  if (!finalWorkflowId) {
    let defaultTemplate = finalWorkflowTemplate;

    // 3. 全局默认流程兜底：如果物理 workflow.json 不存在，降级采用全局默认兜底工作流模板: DIGITAL_EMPLOYEE
    if (!defaultTemplate) {
      console.log(
        `[CreateEmployee] 🔍 物理专属流程未找到，降级采用全局默认兜底工作流模板: DIGITAL_EMPLOYEE`,
      );
      defaultTemplate = await registryService.getWorkflowByKey('DIGITAL_EMPLOYEE', appId);
      if (!defaultTemplate) {
        throw ApiError.internal('系统默认工作流模板 (DIGITAL_EMPLOYEE) 缺失');
      }
    }

    const workflow = await workflowService.createWorkflow(userId, organizationId, {
      appId,
      workflowKey: templateKeyUsed,
      category: 'digitalEmployee',
      name: `${finalName} 的逻辑引擎`,
      description: `针对数字人 ${finalName} 自动生成的对话逻辑`,
      nodes: defaultTemplate.nodes || [],
      edges: defaultTemplate.edges,
      triggerType: defaultTemplate.triggerType,
      scope: 'APP',
    });
    finalWorkflowId = workflow.id || workflow._id;
  }

  return DigitalEmployeeRepository.create({
    appRef: appId,
    name: finalName,
    roleTitle: finalRoleTitle || '',
    avatar: finalAvatar,
    description: finalDescription,
    scenario: finalScenario,
    workflowId: finalWorkflowId,
    metadata: finalMetadata,
    isActive: isActive !== undefined ? isActive : true,
    createdBy: userId,
    updatedBy: userId,
  });
};

const initializeWorkflow = async (id, userId) => {
  const employee = await getEmployeeById(id);
  if (employee.workflowId) return employee;

  const app = await appService.getApplicationById(employee.appRef);
  const organizationId = app.organizationId.toString();

  const defaultTemplate = await registryService.getWorkflowByKey(
    'DIGITAL_EMPLOYEE',
    employee.appRef,
  );

  const workflow = await workflowService.createWorkflow(userId, organizationId, {
    appId: employee.appRef,
    workflowKey: 'DIGITAL_EMPLOYEE',
    category: 'digitalEmployee',
    name: `${employee.name} 的逻辑引擎`,
    description: `针对数字人 ${employee.name} 自动生成的对话逻辑`,
    nodes: defaultTemplate.nodes,
    edges: defaultTemplate.edges,
    triggerType: defaultTemplate.triggerType,
    scope: 'APP',
  });

  return DigitalEmployeeRepository.update(id, {
    workflowId: workflow.id || workflow._id,
    updatedBy: userId,
    updatedAt: new Date(),
  });
};

/**
 * 更新数字员工
 */
const updateEmployee = async (id, updateData, userId) => {
  await getEmployeeById(id);

  // 场景校验
  if (updateData.scenario && !EMPLOYEE_SCENARIO_LIST.includes(updateData.scenario)) {
    throw ApiError.badRequest('无效的使用场景', 'DE_INVALID_SCENARIO');
  }

  // 仅提取支持更新的字段，避免“黑盒”导致的数据污染
  const allowedFields = [
    'name',
    'roleTitle',
    'avatar',
    'description',
    'scenario',
    'workflowId',
    'metadata',
    'isActive',
  ];

  const cleanData = {};
  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined && field !== 'id') {
      if (field === 'roleTitle') {
        cleanData.roleTitle = (updateData.roleTitle || '').trim().toLowerCase();
      } else {
        cleanData[field] = updateData[field];
      }
    }
  });

  return DigitalEmployeeRepository.update(id, {
    ...cleanData,
    updatedBy: userId,
    updatedAt: new Date(),
  });
};

const deleteEmployee = async (id) => {
  await getEmployeeById(id);
  return DigitalEmployeeRepository.delete(id);
};

/**
 * 获取数字员工的执行配置
 * 核心逻辑：加载员工 -> 校验 -> 合并参数 (Metadata + TriggerData)
 */
const getExecutionConfig = async (employeeId, triggerData = {}) => {
  const employee = await getEmployeeById(employeeId);
  if (!employee.isActive) {
    throw ApiError.badRequest('Digital employee is inactive', 'DE_INACTIVE');
  }

  const { workflowId, metadata } = employee;
  if (!workflowId) {
    throw ApiError.badRequest('Employee has no workflow configured', 'DE_NO_WORKFLOW');
  }

  // 合并参数：triggerData 为动态输入 (来自网关、API 或 Chat)，metadata 为预设配置 (员工性格、知识库等)
  const triggeredBy = (
    triggerData.triggeredBy ||
    employee.createdBy ||
    employee.updatedBy ||
    'SYSTEM'
  ).toString();

  // console.log(
  //   'triggeredBy==',
  //   triggeredBy,
  //   triggerData.triggeredBy,
  //   employee.createdBy,
  //   employee.updatedBy,
  // );

  const mergedData = {
    ...(metadata || {}),
    ...triggerData,
    employeeId: employeeId.toString(),
    appId: employee.appRef?.toString(),
    employeeName: employee.name,
    message: triggerData.message || triggerData.query, // 语义对齐：兼容网关的 query 和通用的 message
    triggeredBy,
    triggeredAt: new Date(),
  };

  console.log('TRACE_AINOTE getExecutionConfig returning mergedData:', {
    employeeId,
    workflowId,
    mergedData,
  });

  return { workflowId, mergedData, employee };
};

/**
 * 执行数字员工逻辑
 * 封装了员工配置读取、参数合并、工作流启动等核心逻辑，方便网关、API 等复用
 */
const executeEmployee = async (employeeId, triggerData, options = {}) => {
  const { workflowId, mergedData } = await getExecutionConfig(employeeId, triggerData);

  const client = await getTemporalClient();
  const executionId = options.executionId || `de-${employeeId.substring(0, 8)}-${Date.now()}`;

  await client.workflow.start('runWorkflow', {
    taskQueue: env.TEMPORAL_TASK_QUEUE,
    workflowId: executionId,
    args: [{ id: workflowId }, mergedData, executionId],
  });

  return { executionId, workflowId, employeeId };
};

/**
 * 流式执行数字员工对话 (SSE)
 * 将 UnifiedChatService 作为底座，为其组装员工特有的上下文和配置
 */
const streamEmployeeChat = async (writer, { employeeId, user, orgId, data, ...params }) => {
  console.log('TRACE_AINOTE streamEmployeeChat inputs:', {
    employeeId,
    userId: user.id || user._id,
    orgId,
    data,
    params,
  });

  // 1. 准备配置 (合并员工性格、知识库等)
  const { workflowId, mergedData, employee } = await getExecutionConfig(employeeId, data || {});

  // 2. 实例化通用的对话底座
  const service = new UnifiedChatService({
    user,
    appId: employee.appRef,
    orgId,
    clientPlatform: params.clientPlatform,
  });

  // 3. Launch the stream
  console.log('TRACE_AINOTE streamEmployeeChat calling service.streamChat with:', {
    workflowId,
    mergedData,
    params,
  });

  return service.streamChat(writer, {
    ...params,
    workflowId,
    data: mergedData,
  });
};

const getPresetEmployees = async () => {
  return presetEmployees;
};

export default {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  initializeWorkflow,
  getExecutionConfig,
  executeEmployee,
  streamEmployeeChat,
  getPresetEmployees,
};
