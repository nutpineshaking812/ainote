import { createDeepAgent, CompositeBackend, LocalShellBackend } from 'deepagents';
import { createLLM } from '../../../agent/llm/langchainAi.js';
import { DynamicStructuredTool } from '@langchain/core/tools';
import path from 'path';
import { z } from 'zod';
// import { createLazyBackend, invalidateDocsCache } from './lazy-database-backend.js';
import { DatabaseBackend } from './db-backend.js';
import { createCustomToolAuthMiddleware } from './custom-tool-auth-middleware.js';
import { getToolDisplayMode } from '../../../agent/tools/displayMode.js';

/**
 * Deep Agent 插件入口
 * 职责：初始化 deepagents，调用其规划与执行流，并把思考、工具执行过程通过 execCtx 同步至前端。
 */
export async function handler(params, execCtx) {
  const { prompt, userPrompt, model: modelName, messageId, temperature, enableSearch, jsonMode } = params;

  // 上下文变量统一提取
  const userId = execCtx.executorId;
  const appId = execCtx.appId;
  const orgId = execCtx.orgId;
  const executionId = execCtx.executionId;
  const workflowId = execCtx.workflowId;
  const sessionId = execCtx.triggerData?.sessionId || null;
  const parentExecutionId = execCtx.triggerData?.parentExecutionId || null;

  // 1. 收集通过连线挂载的 Addon 节点资源 (工具、文档与短期记忆)
  let allDocIds = [];
  let conversationId;
  let memoryLimit = 10;

  if (Array.isArray(execCtx.edges) && execCtx.nodeResults) {
    const connectedEdges = execCtx.edges.filter((e) => e.target === execCtx.nodeId);
    for (const edge of connectedEdges) {
      const config = execCtx.nodeResults[edge.source]?.result;
      if (!config) continue;

      if (edge.targetHandle === 'tool-slot') {
        if (config.skillIds) {
          const ids = Array.isArray(config.skillIds)
            ? config.skillIds
            : String(config.skillIds)
                .split(/[\|,]/)
                .map((s) => s.trim())
                .filter(Boolean);
          allDocIds.push(...ids);
        }
      } else if (edge.targetHandle === 'knowledge-slot') {
        if (config.knowledgeIds) {
          const ids = Array.isArray(config.knowledgeIds)
            ? config.knowledgeIds
            : String(config.knowledgeIds)
                .split(/[\|,]/)
                .map((s) => s.trim())
                .filter(Boolean);
          allDocIds.push(...ids);
        }
      } else if (edge.targetHandle === 'memory-slot') {
        if (config.conversationId) conversationId = config.conversationId;
        if (config.limit) memoryLimit = config.limit;
      }
    }
  }

  execCtx.sendConsoleLog(`[DeepAgent] 正在初始化 Agent，模型: ${modelName || '默认'}...`);
  let llm;
  try {
    llm = createLLM(modelName, {
      userId,
      orgId,
      appId,
      taskId: executionId,
      runName: 'deep-agent',
      temperature,
      enable_search: enableSearch !== false, // 默认 true，仅明确传 false 时为 false
      jsonMode: jsonMode === true,           // 默认 false，仅明确传 true 时为 true
    });
  } catch (err) {
    execCtx.sendConsoleLog(`[DeepAgent] 创建模型实例失败: ${err.message}`);
    return { success: false, error: `Failed to create LLM instance: ${err.message}` };
  }

  // 提取原生 Skill 的 Zod Schema 约束，确保 LLM 能精准识别参数
  const getZodSchema = (sDef) => {
    const schema = sDef.inputSchema;
    if (!schema) return z.object({}).passthrough();
    if (typeof schema.safeParse === 'function' || (schema._def && schema.parse)) {
      return schema;
    }
    const jsonSchema = schema.jsonSchema || schema;
    if (jsonSchema && typeof jsonSchema === 'object') {
      try {
        const properties = jsonSchema.properties || {};
        const shape = {};
        const requiredFields = jsonSchema.required || [];

        for (const [key, prop] of Object.entries(properties)) {
          let field = z.any();
          if (prop.type === 'string') {
            field = z.string();
          } else if (prop.type === 'number' || prop.type === 'integer') {
            field = z.number();
          } else if (prop.type === 'boolean') {
            field = z.boolean();
          } else if (prop.type === 'array') {
            field = z.array(z.any());
          } else if (prop.type === 'object') {
            field = z.object({}).passthrough();
          }

          if (prop.description) {
            field = field.describe(prop.description);
          }

          if (!requiredFields.includes(key)) {
            field = field.optional();
          }
          shape[key] = field;
        }
        return z.object(shape).passthrough();
      } catch (e) {
        // ignore and fallback
      }
    }
    return z.object({}).passthrough();
  };
  // 2. 初始化沙箱后端实例
  // const { localWorkspace } = params || {};
  // const isTauriClient = execCtx.triggerData?.clientPlatform === 'tauri';
  let sandboxBackend = null;

  // if (isTauriClient) {
  //   // 1. 客户端（Tauri）模式
  //   if (localWorkspace) {
  //     sandboxBackend = new LocalShellBackend({
  //       rootDir: localWorkspace,
  //       virtualMode: true,
  //     });
      
  //     // 拦截并重写执行命令中的虚拟绝对路径为本地物理绝对路径
  //     const originalExecute = sandboxBackend.execute.bind(sandboxBackend);
  //     sandboxBackend.execute = async (command) => {
  //       if (!command || typeof command !== 'string') {
  //         return originalExecute(command);
  //       }
        
  //       const systemPrefixes = [
  //         '/bin/', '/usr/', '/etc/', '/dev/', '/lib/', '/lib64/', '/opt/', 
  //         '/sbin/', '/sys/', '/proc/', '/private/', '/Users/', '/System/', '/Applications/', '/Library/'
  //       ];
        
  //       // 匹配以 / 开头的路径单词（支持字母、数字、点、横杠、下划线和中文字符等）
  //       const pathRegex = /(?:^|[\s="'])\/[a-zA-Z0-9_\-\.\/\u4e00-\u9fa5]*/g;
        
  //       const rewrittenCommand = command.replace(pathRegex, (match) => {
  //         const prefixChar = match.match(/^[\s="']/)?.[0] || '';
  //         const virtPath = match.substring(prefixChar.length);
          
  //         if (!virtPath.startsWith('/')) {
  //           return match;
  //         }
          
  //         // 如果是系统前缀，不进行重写
  //         const isSystem = systemPrefixes.some(sysPref => virtPath.startsWith(sysPref) || virtPath === sysPref.slice(0, -1));
  //         if (isSystem) {
  //           return match;
  //         }
          
  //         // 将虚拟绝对路径重写为本地绝对路径
  //         const relativePart = virtPath.substring(1);
  //         const resolvedPath = path.resolve(localWorkspace, relativePart);
  //         return prefixChar + resolvedPath;
  //       });
        
  //       console.log(`[LocalShellBackend] Command rewriting: "${command}" -> "${rewrittenCommand}"`);
  //       return originalExecute(rewrittenCommand);
  //     };
  //   } else {
  //     // 客户端环境下没有配置 localWorkspace，则默认根后端拒绝文件读写，仅 docs 路由可用
  //     sandboxBackend = {
  //       async read() { return { error: 'No workspace directory configured. Please set a local workspace in the node properties.' }; },
  //       async write() { return { error: 'No workspace directory configured. Please set a local workspace in the node properties.' }; },
  //       async ls() { return { files: [] }; },
  //       async edit() { return { error: 'No workspace directory configured. Please set a local workspace in the node properties.' }; },
  //       async grep() { return { matches: [] }; },
  //       async glob() { return { files: [] }; },
  //       async execute() { return { output: 'No workspace directory configured', exitCode: 1, truncated: false }; }
  //     };
  //   }
  // } else {
    // 2. Web SaaS 模式：默认强制使用远程隔离沙箱作为后端，杜绝使用和泄漏服务器本地磁盘路径
    const { createRemoteSandboxBackend } = await import('./remote-sandbox-backend.js');
    sandboxBackend = createRemoteSandboxBackend(executionId, execCtx);
  // }

  // 3. 构建 DatabaseBackend (云端文档存储)，将 sandboxBackend 传入以支撑 execute 的透明转发
  // invalidateDocsCache 已在新的 db-backend 中通过实时数据库查询被彻底废弃，旧逻辑注释留档
  // invalidateDocsCache(userId, appId);
  // const dbBackendDocs = createLazyBackend({
  //   userId,
  //   appId,
  //   logger: execCtx,
  //   allDocIds,
  //   sessionId,
  //   routePrefix: 'docs',
  // });
  const dbBackendDocs = new DatabaseBackend({
    userId,
    appId,
    logger: execCtx,
    allDocIds,
    sessionId,
    sandboxBackend,
  });

  // 使用 CompositeBackend 装配路由分发：文档访问统一挂载到 '/docs' 路由下
  const backend = new CompositeBackend(sandboxBackend, {
    '/docs': dbBackendDocs,
  });

  // 3. 解析绑定的 Skills 并处理文档技能的动态同步
  const deepAgentTools = [];
  let updatedSystemPrompt = prompt || '';
  
  // 注入运行时环境约束提示语，规范 Agent 的文件写入与执行行为
  const runtimeConstraintsPrompt = `
[运行时环境约束 / Runtime Environment Constraints]
1. 虚拟文件系统结构：
   - 技能文档（SKILL.md）、长期记忆（agent.md）挂载在 "/docs" 目录下。例如："/docs/my-skill/SKILL.md"。
   - 技能文档 "/docs/<skill-name>/SKILL.md" 采用 Markdown 格式，代码（如 Python, Shell 等）必须使用 \`\`\` 代码块包裹内嵌在其中，不可在 "/docs" 下写入或创建单独的脚本文件。
2. 技能的读取与运行：
   - 当需要使用或执行某个技能时，你必须遵循以下步骤：
     1) 调用 read 工具读取 "/docs/<skill-name>/SKILL.md" 获取它的使用指南与内嵌代码。
     2) 在内存中解析并提取出该技能文档里你想执行的内嵌代码块。
     3) 调用 write 工具将提取的代码写入沙箱的临时物理目录，如 "/tmp/run.py"。
     4) 调用 execute 工具在沙箱里执行该临时脚本，例如：\`execute python3 /tmp/run.py\`。
3. 临时文件系统：
   - 所有的代码运行、配置写入、日志记录以及中间生成产物，必须直接写入沙箱工作区（例如 \`/tmp\` 下或绝对路径如 \`/my_script.py\`，绝对不能写入 "/docs" 下，否则会导致只读报错）。
`;
  updatedSystemPrompt = `${updatedSystemPrompt.trim()}\n\n${runtimeConstraintsPrompt.trim()}`;

  // 技能列表已在入口处统一解析完成

  try {
    const { getGlobalTools, getNonGlobalTools } = await import('../../../agent/tools/index.js');
    const { default: skillService } = await import('../../../services/skill.service.js');

    // a) 默认注入平台全局内置技能
    const globalSkills = getGlobalTools();
    for (const gSkill of globalSkills) {
      const toolInstance = new DynamicStructuredTool({
        name: gSkill.name,
        description: gSkill.description || gSkill.name,
        schema: getZodSchema(gSkill),
        func: async (args) => {
          execCtx.sendConsoleLog(`[DeepAgent] 执行系统全局 Skill: ${gSkill.name}...`);
          const res = await skillService.execute(gSkill, args, {
            userId,
            orgId,
            appId,
            taskId: workflowId || executionId,
            executionId,
            sessionId,
            parentExecutionId: parentExecutionId || executionId,
            masterSystemPrompt: prompt || '',
          });
          return typeof res === 'string' ? res : JSON.stringify(res);
        },
      });
      deepAgentTools.push(toolInstance);
    }

    // b) 加载绑定的参数化工具 + 文档技能的关联工具
    if (allDocIds.length > 0) {
      const requestedIds = allDocIds;

      if (requestedIds.length > 0) {
        execCtx.sendConsoleLog(
          `[DeepAgent] 正在加载绑定的 ${requestedIds.length} 个参数化 Skills...`,
        );
        const dbSkills = await skillService.getAvailableSkills({
          userId,
          orgId,
          appId,
          requestedIds,
        });

        const allCandidates = [...dbSkills, ...getNonGlobalTools()];
        for (const reqId of requestedIds) {
          const skillDef = allCandidates.find(
            (s) =>
              String(s.id || s._id) === String(reqId) ||
              s.name === reqId ||
              s.id === `system:${reqId}` ||
              s.id === `builtin:${reqId}`,
          );

          // 仅将参数化工具类 (MCP、Code等，而非文档型) 绑定到 tools 属性上
          if (skillDef && skillDef.type !== 'DOCUMENT' && skillDef.type !== 'PACKAGE_SKILL') {
            execCtx.sendConsoleLog(
              `[DeepAgent] 成功绑定 Tool: ${skillDef.name} (${skillDef.type})`,
            );
            const toolInstance = new DynamicStructuredTool({
              name: skillDef.name,
              description: skillDef.description || skillDef.name,
              schema: getZodSchema(skillDef),
              func: async (args) => {
                execCtx.sendConsoleLog(`[DeepAgent] 执行底层 Skill: ${skillDef.name}...`);
                const res = await skillService.execute(skillDef, args, {
                  userId,
                  orgId,
                  appId,
                  taskId: workflowId || executionId,
                  executionId,
                  sessionId,
                  parentExecutionId: parentExecutionId || executionId,
                  masterSystemPrompt: prompt || '',
                });
                return typeof res === 'string' ? res : JSON.stringify(res);
              },
            });
            deepAgentTools.push(toolInstance);
          }
        }
      }
      // c) 注册所有非全局的系统工具，让 Agent 可以通过阅读 SOP 动态提取和执行它们
      execCtx.sendConsoleLog('[DeepAgent] 正在注册系统非全局工具库以支持动态提权...');
      const systemTools = getNonGlobalTools();
      for (const toolDef of systemTools) {
        // 避免重复注册
        if (deepAgentTools.some((t) => t.name === toolDef.name)) continue;

        const toolInstance = new DynamicStructuredTool({
          name: toolDef.name,
          description: toolDef.description || toolDef.name,
          schema: getZodSchema(toolDef),
          func: async (args) => {
            execCtx.sendConsoleLog(`[DeepAgent] 动态执行工具: ${toolDef.name}...`);
            const res = await skillService.execute(toolDef, args, {
              userId,
              orgId,
              appId,
              taskId: workflowId || executionId,
              executionId,
              sessionId,
              parentExecutionId: parentExecutionId || executionId,
              masterSystemPrompt: prompt || '',
            });
            return typeof res === 'string' ? res : JSON.stringify(res);
          },
        });
        deepAgentTools.push(toolInstance);
      }
    }
  } catch (err) {
    execCtx.sendConsoleLog(`[DeepAgent] 初始化 Skills 出现异常: ${err.message}`);
  }

  // 4. 定义专门的工具调用参数纠错中间件，解决非原生模型参数双重序列化嵌套在 input 字段里的问题
  const patchToolInputMiddleware = {
    name: "patchToolInputMiddleware",
    wrapModelCall: async (request, handler) => {
      const response = await handler(request);
      if (response) {
        // 1. 修复 message.tool_calls
        if (response.tool_calls && Array.isArray(response.tool_calls)) {
          response.tool_calls = response.tool_calls.map(tc => {
            let args = tc.args;
            if (args && typeof args === 'object' && Object.keys(args).length === 1 && typeof args.input === 'string') {
              try {
                const parsed = JSON.parse(args.input);
                if (parsed && typeof parsed === 'object') {
                  return { ...tc, args: parsed };
                }
              } catch (e) {}
            }
            return tc;
          });
        }

        // 2. 修复 message.additional_kwargs.tool_calls (针对某些旧版本或兼容模式的 Parser)
        const toolCalls = response.additional_kwargs?.tool_calls;
        if (Array.isArray(toolCalls)) {
          response.additional_kwargs.tool_calls = toolCalls.map(tc => {
            if (tc.function?.arguments) {
              try {
                let args = typeof tc.function.arguments === 'string' 
                  ? JSON.parse(tc.function.arguments) 
                  : tc.function.arguments;
                if (args && typeof args === 'object' && Object.keys(args).length === 1 && typeof args.input === 'string') {
                  const parsed = JSON.parse(args.input);
                  if (parsed && typeof parsed === 'object') {
                    return {
                      ...tc,
                      function: {
                        ...tc.function,
                        arguments: JSON.stringify(parsed)
                      }
                    };
                  }
                }
              } catch (e) {}
            }
            return tc;
          });
        }
      }
      return response;
    }
  };

  // 5. 初始化 Deep Agent
  const agentOptions = {
    model: llm,
    systemPrompt: updatedSystemPrompt,
    tools: deepAgentTools,
    skills: ['/', '/docs'],
    memory: ['/docs/agent.md'],
    backend,
    middleware: [
      patchToolInputMiddleware,
      createCustomToolAuthMiddleware({
        globalToolNames: [
          'read_file',
          'ls',
          'grep',
          'glob',
          'edit_file',
          'write_file',
          'execute',
        ],
        logger: execCtx,
      }),
    ],
  };

  let agent;
  try {
    execCtx.sendConsoleLog('[DeepAgent] 正在调用 createDeepAgent...');
    agent = createDeepAgent(agentOptions);
    execCtx.sendConsoleLog('[DeepAgent] createDeepAgent 创建成功');
  } catch (err) {
    execCtx.sendConsoleLog(`[DeepAgent] 初始化失败: ${err.message}\n${err.stack}`);
    return { success: false, error: `Agent initialization failed: ${err.message}` };
  }

  try {
    execCtx.sendConsoleLog('[DeepAgent] 启动规划与执行...');

    const messages = [];
    let hasCurrentPromptInHistory = false;

    // 记忆配置已在入口处统一解析完成

    if (conversationId) {
      try {
        const { buildHistoryMessage } = await import('../../../agent/utils/build_message.js');
        execCtx.sendConsoleLog(`[DeepAgent] 正在从会话 ${conversationId} 加载历史聊天记忆...`);
        const recent = await buildHistoryMessage(conversationId);
        if (Array.isArray(recent)) {
          messages.push(...recent);
        }

        // 归一化 userPrompt 为纯文本（兼容 string / array / stringified JSON 格式）
        const normalizeContent = (raw) => {
          if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                return parsed.map((c) => (typeof c === 'string' ? c : c?.text || '')).join('');
              }
              return raw;
            } catch (e) {
              return raw;
            }
          }
          if (Array.isArray(raw)) {
            return raw.map((c) => (typeof c === 'string' ? c : c?.text || '')).join('');
          }
          return String(raw || '');
        };
        const normalizedUserPrompt = normalizeContent(userPrompt);

        if (messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          if (
            lastMsg &&
            (lastMsg.constructor.name === 'HumanMessage' || lastMsg._getType?.() === 'human')
          ) {
            const lastContent = normalizeContent(lastMsg.content);
            execCtx.sendConsoleLog(
              `[DeepAgent] 去重检查: lastContent=${JSON.stringify(lastContent)}, userPrompt=${JSON.stringify(normalizedUserPrompt)}, match=${lastContent === normalizedUserPrompt}`,
            );
            if (lastContent === normalizedUserPrompt) {
              hasCurrentPromptInHistory = true;
            }
          }
        }
      } catch (err) {
        execCtx.sendConsoleLog(`[DeepAgent] 加载历史记忆失败: ${err.message}`);
      }
    }

    if (!hasCurrentPromptInHistory && userPrompt) {
      const { HumanMessage } = await import('@langchain/core/messages');
      // 确保 userPrompt 是纯文本字符串
      let promptText = userPrompt;
      if (Array.isArray(promptText)) {
        promptText = promptText.map((c) => (typeof c === 'string' ? c : c?.text || '')).join('');
      } else if (typeof promptText !== 'string') {
        promptText = String(promptText || '');
      }
      messages.push(new HumanMessage({ content: promptText }));
    }

    if (messages.length === 0) {
      const { HumanMessage } = await import('@langchain/core/messages');
      messages.push(new HumanMessage({ content: userPrompt || 'Hello' }));
    }
    execCtx.sendConsoleLog(`[DeepAgent] 当前装载的消息历史轮数: ${messages.length}`);

    // 2. 启动流式事件监听
    execCtx.sendConsoleLog('[DeepAgent] 正在调用 streamEvents...');
    const eventStream = agent.streamEvents(
      {
        messages,
      },
      { version: 'v2' },
    );

    let finalContent = '';
    let currentThinking = '';
    let currentContent = '';
    const assistantMessageId = messageId;
    
    // 用于在流式输出中，根据 index 还原后续 chunk 缺失的 id 和 name
    const toolCallIdsByIndex = new Map();
    const toolCallNamesByIndex = new Map();

    let lastCreatedAtTime = Date.now();
    const getNextCreatedAt = () => {
      const now = Date.now();
      if (now > lastCreatedAtTime) {
        lastCreatedAtTime = now;
      } else {
        lastCreatedAtTime++; // 保证递增，防止同毫秒内排序混乱
      }
      return new Date(lastCreatedAtTime);
    };

    const commitBuffers = async () => {
      if (!assistantMessageId) return;
      if (!currentThinking && !currentContent) return;
      try {
        const { appendMessageSegments } = await import('../../../services/conversationService.js');
        const segmentsToAppend = [];
        if (currentThinking) {
          segmentsToAppend.push({
            type: 'thought',
            content: currentThinking,
            createdAt: getNextCreatedAt(),
          });
          currentThinking = '';
        }
        if (currentContent) {
          segmentsToAppend.push({
            type: 'assistant',
            content: currentContent,
            createdAt: getNextCreatedAt(),
          });
          currentContent = '';
        }
        if (segmentsToAppend.length > 0) {
          await appendMessageSegments(assistantMessageId, segmentsToAppend);
        }
      } catch (err) {
        execCtx.sendConsoleLog(`[DeepAgent] 提交缓存片段失败: ${err.message}`);
      }
    };

    try {
      for await (const event of eventStream) {
        const eventType = event.event;

        // 处理大模型生成的输出块
        if (eventType === 'on_chat_model_stream') {
          const chunk = event.data.chunk;

          // 提取思考内容 (Thinking Content, 针对 DeepSeek R1 等推理模型)
          const thinking =
            chunk.additional_kwargs?.reasoning_content ||
            chunk.additional_kwargs?.thinking ||
            chunk.lc_kwargs?.additional_kwargs?.reasoning_content ||
            chunk.lc_kwargs?.additional_kwargs?.thinking;

          if (thinking) {
            currentThinking += thinking;
            execCtx.sendProgress('thinking-delta', { content: thinking });
          }

          // 提取正文内容
          let text = '';
          if (typeof chunk.content === 'string') {
            text = chunk.content;
          } else if (Array.isArray(chunk.content)) {
            text = chunk.content
              .filter((c) => c.type === 'text' || typeof c === 'string')
              .map((c) => (typeof c === 'string' ? c : c.text))
              .join('');
          }

          if (text) {
            finalContent += text;
            currentContent += text;
            execCtx.sendProgress('text-delta', { content: text });
          }

          // 提取工具调用参数片段并发送给前端，防止大任务参数（如大 HTML 代码）生成时界面卡死
          const toolCallChunks = chunk.tool_call_chunks || chunk.lc_kwargs?.tool_call_chunks;
          if (Array.isArray(toolCallChunks) && toolCallChunks.length > 0) {
            for (const tcChunk of toolCallChunks) {
              const idx = tcChunk.index ?? 0;
              if (tcChunk.id) {
                toolCallIdsByIndex.set(idx, tcChunk.id);
              }
              if (tcChunk.name) {
                toolCallNamesByIndex.set(idx, tcChunk.name);
              }

              const resolvedId = tcChunk.id || toolCallIdsByIndex.get(idx) || `call_idx_${idx}`;
              const name = tcChunk.name || toolCallNamesByIndex.get(idx);
              const displayMode = name ? getToolDisplayMode(name) : 'normal';

              // 如果 displayMode 是 compact 或 name-only，不向前端流式发送参数内容以符合显示规范
              if (tcChunk.args && displayMode !== 'compact' && displayMode !== 'name-only') {
                // execCtx.sendProgress('tool-input-delta', {
                //   toolCallId: resolvedId,
                //   name: name,
                //   toolName: name,
                //   inputTextDelta: tcChunk.args,
                // });
              }
            }
          }
        }

        // 处理工具调用开始
        else if (eventType === 'on_tool_start') {
          // 先提交之前的思考和正文缓存，确保数据库中顺序正确
          await commitBuffers();

          const toolCallId = event.run_id || `call_${Date.now()}`;
          const toolName = event.name;
          const toolInput = event.data.input;

          // 清洗双重序列化的入参
          let cleanedInput = toolInput;
          if (cleanedInput && typeof cleanedInput === 'object') {
            if (Object.keys(cleanedInput).length === 1 && typeof cleanedInput.input === 'string') {
              try {
                const parsed = JSON.parse(cleanedInput.input);
                if (parsed && typeof parsed === 'object') {
                  cleanedInput = parsed;
                }
              } catch (e) {}
            }
          }

          // 根据 displayMode 决定是否推送详细参数
          const displayMode = getToolDisplayMode(toolName);

          // 实时推送到前端展示工具开始执行
          execCtx.sendProgress('tool-input-start', {
            toolCallId,
            toolName,
          });

          // 如果是 compact 或 name-only，推送空的 input 以便前端立即结束该段的 loading 动画且不展示参数详情
          if (displayMode === 'compact' || displayMode === 'name-only') {
            execCtx.sendProgress('tool-input-available', {
              toolCallId,
              toolName,
              input: '',
            });
          } else {
            execCtx.sendProgress('tool-input-available', {
              toolCallId,
              toolName,
              input: typeof cleanedInput === 'string' ? cleanedInput : JSON.stringify(cleanedInput),
            });
          }

          execCtx.sendConsoleLog(
            `[工具执行中] 名称: ${toolName}, 参数: ${JSON.stringify(cleanedInput)}`,
          );

          // 持久化工具调用意图
          if (assistantMessageId) {
            try {
              const { appendMessageSegments } =
                await import('../../../services/conversationService.js');
              await appendMessageSegments(assistantMessageId, [
                {
                  type: 'tool_call',
                  content: { id: toolCallId, name: toolName, args: cleanedInput },
                  createdAt: getNextCreatedAt(),
                },
              ]);
            } catch (err) {
              execCtx.sendConsoleLog(`[DeepAgent] 持久化工具调用失败: ${err.message}`);
            }
          }
        }

        // 处理工具调用结束
        else if (eventType === 'on_tool_end') {
          const toolCallId = event.run_id;
          const toolName = event.name;
          const toolOutput = event.data.output;

          // 清洗工具输出结果，直接优先读取类实例的 content 属性或对象的 result 字段
          let cleanedOutput = toolOutput;
          if (cleanedOutput && typeof cleanedOutput === 'object' && !Array.isArray(cleanedOutput)) {
            if (cleanedOutput.content !== undefined) {
              cleanedOutput = cleanedOutput.content;
            } else if (cleanedOutput.result !== undefined) {
              cleanedOutput = cleanedOutput.result;
            }
          }

          // 根据 displayMode 决定是否推送工具结果给前端
          const displayMode = getToolDisplayMode(toolName);

          // 如果是 name-only，推送空的 result 以便前端结束 loading 动画且不展示任何内容
          const resultPayload = displayMode === 'name-only'
            ? ''
            : (typeof cleanedOutput === 'string' ? cleanedOutput : JSON.stringify(cleanedOutput));

          // 实时同步工具返回结果
          execCtx.sendProgress('tool-result', {
            toolCallId,
            toolName,
            result: resultPayload,
          });

          execCtx.sendConsoleLog(
            `[工具完成] 名称: ${toolName}, 结果: ${JSON.stringify(cleanedOutput).substring(0, 200)}...`,
          );

          // 持久化工具执行结果
          if (assistantMessageId) {
            try {
              const { appendMessageSegments } =
                await import('../../../services/conversationService.js');
              await appendMessageSegments(assistantMessageId, [
                {
                  type: 'tool_output',
                  content: {
                    toolCallId,
                    result:
                      typeof cleanedOutput === 'string' ? cleanedOutput : JSON.stringify(cleanedOutput),
                  },
                  createdAt: getNextCreatedAt(),
                },
              ]);
            } catch (err) {
              execCtx.sendConsoleLog(`[DeepAgent] 持久化工具结果失败: ${err.message}`);
            }
          }
        }
      }

      // stream 结束，提交最后一轮遗留的思考和最终回答到数据库
      await commitBuffers();

      execCtx.sendConsoleLog('[DeepAgent] 任务顺利完成。');

      return {
        success: true,
        result: finalContent,
      };
    } catch (streamError) {
      // 尝试提取 MiddlewareError 中的中间件名称
      const middlewareName = streamError.name || streamError['~middleware'] || '未知';
      const cause = streamError.cause || streamError;
      execCtx.sendConsoleLog(
        `[DeepAgent] 流处理异常 | 中间件: ${middlewareName} | 错误: ${streamError.message}\n` +
          `cause: ${cause?.message || cause}\n` +
          `cause.stack: ${cause?.stack?.split('\n').slice(0, 10).join('\n')}\n` +
          `outer.stack: ${streamError.stack?.split('\n').slice(0, 10).join('\n')}`,
      );
      return {
        success: false,
        error: streamError.message,
      };
    }
  } catch (error) {
    execCtx.sendConsoleLog(`[DeepAgent] 执行发生异常中断: ${error.message}\n${error.stack}`);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    // 远程沙盒交由 OpenSandbox Server 根据 timeout 机制自动空闲超时回收
  }
}
