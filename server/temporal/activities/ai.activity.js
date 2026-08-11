import { logger } from '../../config/logger.js';
import {
  getSkillDiscoveryPrompt,
  formatSkillDiscoverySnippet,
  getSystemProtocolPrompt,
  getMemoryRetrievalPrompt,
  getToolBatchingPrompt,
  getUserRefsPrompt,
} from '../../agent/prompts/discovery.js';
import { ApplicationFailure } from '@temporalio/activity';
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';

/**
 * Specialized mapper for "Injected Messages" which carry rich parts and document metadata.
 */
const mapInjectedMessage = (item) => {
  if (!item) return null;

  // 1. Resolve content from parts
  let content = '';
  if (Array.isArray(item.parts)) {
    content = item.parts
      .map((p) => {
        if (typeof p === 'string') return p;
        if (p.type === 'text') return p.text;
        return JSON.stringify(p);
      })
      .join('\n');
  } else {
    content = String(item.content || '');
  }

  // 2. Resolve role to LangChain class
  const role = item.role || 'user';
  if (role === 'system') return new SystemMessage(content);
  if (role === 'assistant') {
    return new AIMessage({
      content,
      tool_calls: (item.tool_calls || []).map((tc) => {
        return tc;
      }),
    });
  }

  // Default to HumanMessage
  return new HumanMessage(content);
};

/**
 * Unified message mapper to handle raw objects, BlockNote parts, and LangChain normalization.
 */
const mapRawMessage = (item) => {
  if (!item) return null;

  // Unify type from both Physical segments and Logical/Memory objects
  const type =
    item.type ||
    (item.role === 'user'
      ? 'user'
      : item.role === 'assistant'
        ? 'assistant'
        : item.role === 'tool'
          ? 'tool_output'
          : item.role);
  const content =
    typeof item.content === 'object' && item.content.result
      ? typeof item.content.result === 'string'
        ? item.content.result
        : JSON.stringify(item.content.result)
      : typeof item.content === 'object'
        ? JSON.stringify(item.content)
        : String(item.content || '');

  const formatToolCall = (tc) => {
    if (!tc) return null;

    let obj = tc;
    if (typeof tc === 'string' && tc.trim().startsWith('{')) {
      try {
        obj = JSON.parse(tc);
      } catch (e) {
        return null;
      }
    }

    if (!obj || typeof obj !== 'object') return null;

    // 1. Identify name
    const name = obj.name || obj.function?.name;
    if (!name) return null;

    // 2. Resolve args as an OBJECT (LangChain requirement)
    let argsRaw = obj.args || obj.function?.arguments;
    let argsObj = {};
    if (typeof argsRaw === 'string') {
      try {
        argsObj = JSON.parse(argsRaw);
      } catch (e) {
        argsObj = {};
      }
    } else if (typeof argsRaw === 'object' && argsRaw !== null) {
      argsObj = argsRaw;
    }

    // 3. Return LANGCHAIN format ToolCall (NOT OpenAI raw format)
    return {
      id: obj.id || obj.toolCallId || obj.tool_call_id || `call_${Date.now()}`,
      name: name,
      args: argsObj,
    };
  };

  switch (type) {
    case 'thought':
      return new AIMessage(`<thought>\n${content}\n</thought>`);
    case 'tool_call':
      // Use the formatter to ensure OpenAI/LangChain compatibility
      const tc = formatToolCall(item.content || item);
      return new AIMessage({ content: '', tool_calls: tc ? [tc] : [] });
    case 'tool_output':
      const tid = item.content?.toolCallId || item.tool_call_id || item.toolCallId;
      return new ToolMessage({ content, tool_call_id: tid });
    case 'chart_data':
    case 'assistant':
      // Support nested tool_calls with proper re-mapping
      const tcs = (item.tool_calls || item.toolCalls || []).map(formatToolCall).filter(Boolean);
      return new AIMessage({
        content: item.thought ? `<thought>\n${item.thought}\n</thought>\n${content}` : content,
        tool_calls: tcs,
      });
    case 'system':
      return new SystemMessage(content);
    case 'user':
    default:
      return new HumanMessage(content);
  }
};
import { getGlobalTools, getToolDisplayMode } from '../../agent/tools/index.js';
import { openAITools } from '../../agent/utils/tool_utils.js';
import skillService from '../../services/skill.service.js';
import DocumentRepository from '../../repositories/document.repository.js';
import { emitActivityEvent } from './system.activity.js';
import AgentCore from '../../agent/core/AgentCore.js';
import { Context } from '@temporalio/activity';

/**
 * Single-Turn AI Activity for Orchestrator Pattern.
 *
 * This Activity does ONE step of LLM inference and immediately returns.
 * It does NOT execute tool calls internally. Instead, it returns the tool_calls
 * back to the Workflow, which dispatches tools as native child workflows (executeChild).
 *
 * This eliminates Activity-slot-holding deadlocks when tools invoke sub-workflows.
 *
/**
 * Resolves available skills, matches them against text context and explicit selection,
 * and partitions them into parametric tools and no-param standard procedure documents.
 */
export const resolveAndPartitionSkills = async (data) => {
  const {
    messages = [],
    prompt,
    userPrompt,
    userId,
    orgId,
    appId,
    skillIds = [],
    empEnhancedSkillIds = [],
  } = data;

  const requestedIds = Array.isArray(skillIds) ? [...skillIds] : [];
  if (Array.isArray(empEnhancedSkillIds)) {
    requestedIds.push(...empEnhancedSkillIds);
  }

  // 1. Load skills
  const allSkills = await skillService.getAvailableSkills({
    userId,
    orgId,
    appId,
    requestedIds,
  });
  const selectedSkillIds = requestedIds.map((id) => String(id));
  // console.log('selectedSkillIds', selectedSkillIds);

  // Collect all text from prompt, userPrompt, message history, and loaded document contents
  let scanText = ` ${prompt || ''} ${userPrompt || ''}`;
  if (Array.isArray(messages)) {
    messages.forEach((msg) => {
      if (msg) {
        if (typeof msg.content === 'string') {
          scanText += ` ${msg.content}`;
        } else if (typeof msg.content === 'object' && msg.content !== null) {
          scanText += ` ${JSON.stringify(msg.content)}`;
        }
        if (Array.isArray(msg.parts)) {
          msg.parts.forEach((p) => {
            if (typeof p === 'string') scanText += ` ${p}`;
            else if (p && p.text) scanText += ` ${p.text}`;
          });
        }
      }
    });
  }

  // Load the content of private DOCUMENT skills to scan them as well
  // const docSkills = allSkills.filter((s) => s.type === 'DOCUMENT');
  // if (docSkills.length > 0) {
  //   try {
  //     const docIds = docSkills.map((s) => s.implementationRef);
  //     const docs = await DocumentRepository.findAll({
  //       where: (t, d) => d.inArray(t.id, docIds),
  //     });
  //     docs.forEach((doc) => {
  //       scanText += ` ${doc.contentPlain || ''}`;
  //     });
  //   } catch (e) {
  //     logger.warn({ e }, '[ai.activity] Failed to load document contents for tool scanning');
  //   }
  // }

  // Rigorous matching for SKILL_REF annotations in the context (e.g., [SKILL_REF: type:id | Title])
  const skillRefRegex = /\[SKILL_REF:\s*([^:]+):([^|\]]+?)\s*(?:\||\])/g;
  let skillRefMatch;
  while ((skillRefMatch = skillRefRegex.exec(scanText)) !== null) {
    const type = skillRefMatch[1].trim();
    const refId = skillRefMatch[2].trim();

    if (type === 'mcp') {
      const parts = refId.split(':');
      if (parts.length > 0) {
        selectedSkillIds.push(`mcp:${parts[0]}:*`);
      }
    } else if (type === 'tool') {
      selectedSkillIds.push(refId);
    } else if (type === 'doc') {
      selectedSkillIds.push(`doc:${refId}`);
    }
  }
  // console.log('selectedSkillIds-2', selectedSkillIds);

  // Gather active MCP Server IDs and append wildcard selectors to selectedSkillIds
  for (const s of allSkills) {
    if (s.type === 'MCP') {
      const isExplicitlySelected =
        selectedSkillIds.includes(String(s.id)) ||
        selectedSkillIds.includes(String(s.name)) ||
        selectedSkillIds.includes(String(s.label)) ||
        (s.mcpServerId && selectedSkillIds.includes(`mcp:${s.mcpServerId}:*`)) ||
        (s.mcpServerName && selectedSkillIds.includes(`mcp:${s.mcpServerName}:*`));

      let isMentioned = false;
      const escapedName = (s.name || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const escapedId = (s.id || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

      const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
      if (escapedName && nameRegex.test(scanText)) {
        isMentioned = true;
      } else if (escapedId && scanText.includes(s.id)) {
        isMentioned = true;
      } else if (s.mcpServerId && scanText.includes(s.mcpServerId)) {
        isMentioned = true;
      } else if (s.mcpServerName && scanText.includes(s.mcpServerName)) {
        isMentioned = true;
      }

      if (isExplicitlySelected || isMentioned) {
        if (s.mcpServerId) {
          selectedSkillIds.push(`mcp:${s.mcpServerId}:*`);
        }
        if (s.mcpServerName) {
          selectedSkillIds.push(`mcp:${s.mcpServerName}:*`);
        }
      }
    }
  }

  // console.log('selectedSkillIds-3', selectedSkillIds);

  const userSelectedSkills = allSkills.filter((s) => {
    // 1. Direct ID match or matching name/label (some tools might be requested by name)
    if (
      selectedSkillIds.includes(String(s.id)) ||
      selectedSkillIds.includes(String(s.name)) ||
      selectedSkillIds.includes(String(s.label))
    ) {
      return true;
    }

    // 2. Wildcard match for MCP: mcp:serverId:* OR mcp:serverName:*
    if (s.type === 'MCP') {
      const isIdWildcardSelected =
        s.mcpServerId && selectedSkillIds.includes(`mcp:${s.mcpServerId}:*`);
      const isNameWildcardSelected =
        s.mcpServerName && selectedSkillIds.includes(`mcp:${s.mcpServerName}:*`);

      if (isIdWildcardSelected || isNameWildcardSelected) return true;
    }

    // 3. On-demand inclusion for DOCUMENT skills
    //    Only register them if their name or ID is explicitly mentioned in the context,
    //    or if they are explicitly selected (e.g. required by workflow/parent).
    if (s.type === 'DOCUMENT' && s.scope === 'PRIVATE') {
      const escapedName = (s.name || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const escapedId = (s.id || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

      const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
      if (escapedName && nameRegex.test(scanText)) {
        return true;
      }
      if (escapedId && scanText.includes(s.id)) {
        return true;
      }
      if (
        selectedSkillIds.includes(String(s.id)) ||
        selectedSkillIds.includes(String(s.name)) ||
        selectedSkillIds.includes(String(s.label))
      ) {
        return true;
      }
      return false;
    }

    // 5. On-demand inclusion for system tools (CODE, SYSTEM)
    //    Only register them if their name or ID is explicitly mentioned in the context.
    if (s.type === 'CODE' || s.type === 'SYSTEM') {
      const escapedName = (s.name || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const escapedId = (s.id || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

      const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
      if (escapedName && nameRegex.test(scanText)) {
        return true;
      }
      if (escapedId && scanText.includes(s.id)) {
        return true;
      }
    }

    return false;
  });

  // console.log('selectedSkillIds-4', userSelectedSkills);

  // Construct skillMap to return to the sandboxed workflow runner
  const skillMap = {};
  for (const s of userSelectedSkills) {
    if (s.name) {
      skillMap[s.name] = s;
    }
  }

  // Partition Skills:
  const parametricTools = [];
  const noParamSkills = [];

  for (const skill of userSelectedSkills) {
    if (skill.type === 'PACKAGE_SKILL') {
      // Always use XML discovery for package skills
      noParamSkills.push(skill);
    } else if (skill.type === 'DOCUMENT' && skill.scope === 'PRIVATE') {
      // Auto-discovered document skills → read_skill / "Read and Follow" pattern
      // AI reads the SOP and follows it, which may chain to other document skills
      noParamSkills.push(skill);
    } else {
      // Explicitly configured skills (WORKFLOW, MCP, CODE, SYSTEM, or DOCUMENT by explicit ID)
      // → native parametric tool calls
      parametricTools.push(skill);
    }
  }

  return {
    userSelectedSkills,
    parametricTools,
    noParamSkills,
    skillMap,
    requestedIds,
    allSkills,
  };
};

export const handleAITurn = async (data, nodeId, workflowId) => {
  const {
    messages = [], // Full conversation history passed by the Workflow
    prompt,
    userPrompt,
    model: modelProvider,
    userId,
    orgId,
    appId,
    executionId,
    sessionId,
    parentExecutionId,
    memoryMessages = [],
    memoryContext = '',
    skillIds = [],
    jsonMode = false,
    enableThinking = false,
    enableSearch = false,
    toolChoice = 'auto',
    outputMode = 'full', //compact、full、silent
    empEnhancedSkillIds = [],
    refs: userRefs = [],
  } = data;

  // console.log('empEnhancedSkillIds', empEnhancedSkillIds);
  const { userSelectedSkills, parametricTools, noParamSkills, skillMap, requestedIds, allSkills } =
    await resolveAndPartitionSkills(data);

  // 2. Build prompt
  let enhancedPrompt = prompt || '';

  // Inject user-selected references (documents, templates, skills from @ mention)
  enhancedPrompt += getUserRefsPrompt(userRefs);

  const globalTools = getGlobalTools();
  // enhancedPrompt += `\n\n${getSystemProtocolPrompt(globalTools)}`;
  enhancedPrompt += `\n\n${getToolBatchingPrompt()}`;

  if (data.memoryWorkflowId) {
    enhancedPrompt += `\n\n${getMemoryRetrievalPrompt()}`;
  }

  // Build SOP hints for explicitly-configured WORKFLOW type skills
  const skillSops = parametricTools
    .filter((s) => s.type === 'WORKFLOW' && s.description)
    .map((s) => `Skill [${s.name}]: ${s.description}`)
    .join('\n\n');

  if (skillSops) {
    enhancedPrompt += `\n\nYou have access to the following specialized skills. Follow their instructions strictly:\n${skillSops}`;
  }

  // Inject Discovery XML for discoverable skills (PACKAGE_SKILL + auto-discovered DOCUMENT skills)
  // These use the "Read and Follow" pattern: AI calls read_skill to load SOP, then follows instructions.
  // Document skills can chain: SOP A references skill B, AI reads B and follows that SOP too.
  if (noParamSkills.length > 0) {
    const promptSnippets = noParamSkills.map(formatSkillDiscoverySnippet);
    enhancedPrompt += `\n\n${getSkillDiscoveryPrompt(promptSnippets)}`;
  }

  console.log(
    '[handleAITurn·DIAG] skill partitioning:',
    JSON.stringify({
      requestedIds,
      totalSkills: allSkills.length,
      userSelectedSkillNames: userSelectedSkills.map((s) => `${s.name}(${s.type})`),
      parametricCount: parametricTools.length,
      noParamCount: noParamSkills.length,
      noParamNames: noParamSkills.map((s) => `${s.name}(${s.type})`),
    }),
  );
  // console.log('enhancedPrompt', enhancedPrompt);

  // 3. Build messages (only on first turn when messages array is empty)
  // 3. Build messages (Ensure re-mapping for Temporal serialized history + BlockNote injection)
  let finalMessages = [];

  const isBlockNoteRequest =
    data.type === 'blocknote' ||
    (data.toolDefinitions &&
      (Object.keys(data.toolDefinitions).includes('applyDocumentOperations') ||
        Object.values(data.toolDefinitions).some(
          (td) => td.name === 'applyDocumentOperations' || td.label === 'applyDocumentOperations',
        )));

  if (isBlockNoteRequest) {
    try {
      const { injectDocumentStateMessages, aiDocumentFormats } =
        await import('@blocknote/xl-ai/server');
      // const messageList =
      //   (messages || []).length > 0
      //     ? messages
      //     : [
      //         {
      //           role: 'user',
      //           content: userPrompt || prompt || 'Continue...',
      //           metadata: data.metadata,
      //         },
      //       ];

      const injectedMessages = injectDocumentStateMessages(userPrompt);
      finalMessages = injectedMessages.map(mapInjectedMessage).filter(Boolean);
      // console.log('messageList', messageList);
      globalTools.splice(0);

      const blockNotePrompt = aiDocumentFormats.html.systemPrompt;
      const combinedSystemPrompt = blockNotePrompt + '\n\n' + (enhancedPrompt || '');

      // Prepend system prompt if it exists
      if (combinedSystemPrompt) {
        if (finalMessages[0] instanceof SystemMessage) {
          finalMessages[0].content = combinedSystemPrompt + '\n\n' + finalMessages[0].content;
        } else {
          finalMessages.unshift(new SystemMessage(combinedSystemPrompt));
        }
      }
    } catch (err) {
      logger.error({ err }, '[ai.activity] Failed to inject BlockNote state in handleAITurn');
      finalMessages = (messages || []).map(mapRawMessage).filter(Boolean);
    }
  } else {
    finalMessages = [new SystemMessage(enhancedPrompt)];
    // console.log('enhancedPrompt', enhancedPrompt);
    if (memoryContext) {
      finalMessages.push(new SystemMessage(`Known Facts & Memory Context:\n${memoryContext}`));
    }
    if (memoryMessages?.length > 0) {
      finalMessages.push(...memoryMessages.map(mapRawMessage).filter(Boolean));
    }
    let normalizedUserPrompt = userPrompt || prompt || 'Proceed.';
    if (typeof normalizedUserPrompt === 'string' && normalizedUserPrompt.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(normalizedUserPrompt);
        if (Array.isArray(parsed)) {
          normalizedUserPrompt = parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    finalMessages.push(new HumanMessage(normalizedUserPrompt));
    finalMessages.push(...(messages || []).map(mapRawMessage).filter(Boolean));
  }

  // console.log('finalMessages', finalMessages);

  // 4. Build tools
  const dynamicTools = [];
  const clientTools = ['sleep'];
  if (data.toolDefinitions) {
    Object.entries(data.toolDefinitions).forEach(([name, def]) => {
      const toolName = def.name || name;
      dynamicTools.push({
        type: 'function',
        function: {
          name: toolName,
          description: def.description || `Tool for ${toolName}`,
          parameters: def.inputSchema?.jsonSchema || def.inputSchema || def.parameters || {},
        },
      });
      clientTools.push(toolName);
    });
  }
  if (data.memoryWorkflowId) {
    // console.log('data.memoryWorkflowId', data.memoryWorkflowId);
    dynamicTools.push({
      type: 'function',
      function: {
        name: 'recall_memory',
        description:
          'Retrieves historical context, facts, or user preferences related to the current query from the memory database.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query to find relevant memories.' },
          },
          required: ['query'],
        },
      },
    });
  }

  // Feed both the selected parametric skills and explicit global built-ins into the formatter
  const combinedTools = [...globalTools, ...parametricTools];

  const openAIToolsFormatted = [...openAITools(combinedTools), ...dynamicTools];
  // console.log('openAIToolsFormatted', globalTools, parametricTools, dynamicTools);

  // 5. One-turn inference via AgentCore.runOneTurn
  let currentToolCallId = null;
  let currentToolName = null;
  const sentToolCallIds = new Set();

  const turnResult = await AgentCore.runOneTurn({
    messages: finalMessages,
    openAIFormattedTools: openAIToolsFormatted,
    clientTools,
    toolChoice: toolChoice,
    jsonMode,
    enableThinking,
    enableSearch,
    traceRole: 'PARENT',
    llmConfig: {
      provider: modelProvider,
      userId,
      orgId,
      appId,
      runName: `wf-node-${nodeId}`,
      taskId: workflowId,
    },
    onThinkingDelta: (content) => {
      if (Context.current().cancellationSignal.aborted) {
        throw new Error('Immediate Abort: Workflow terminated (Thinking)');
      }
      if (outputMode !== 'silent') {
        emitActivityEvent('node:progress', {
          workflowId,
          executionId,
          sessionId,
          parentExecutionId,
          nodeId,
          status: 'thinking-delta',
          content,
        });
      }
    },
    onTextDelta: (content) => {
      // 显式检查取消信号
      if (Context.current().cancellationSignal.aborted) {
        logger.warn(
          {
            workflowId,
            runId: Context.current().info.workflowExecution.runId,
          },
          '[AI Activity] Cancellation detected. Aborting generation.',
        );
        throw new Error('Immediate Abort: Workflow terminated (Text Generation)');
      }

      try {
        Context.current().heartbeat('text-delta');
      } catch (e) {
        throw e;
      }

      if (outputMode !== 'silent') {
        emitActivityEvent('node:progress', {
          workflowId,
          executionId,
          sessionId,
          parentExecutionId,
          nodeId,
          status: 'text-delta',
          content,
        });
      }
    },
    onToolStream: (tcChunks) => {
      // console.log('[ai.activity·onToolStream] received chunks:', JSON.stringify(tcChunks));
      if (!tcChunks?.length) return;
      const tc = tcChunks[0];
      const tid = tc.id || currentToolCallId;
      const tname = tc.name || currentToolName;

      if (tc.id) currentToolCallId = tc.id;
      if (tc.name) currentToolName = tc.name;

      const displayMode = getToolDisplayMode(tname);

      // 1. Send start event for EACH unique tool call (always emit name so UI knows something is running)
      if (outputMode !== 'silent' && tid && !sentToolCallIds.has(tid)) {
        emitActivityEvent('node:progress', {
          workflowId,
          executionId,
          sessionId,
          parentExecutionId,
          nodeId,
          status: 'tool-input-start',
          toolCallId: tid,
          toolName: tname,
        });
        sentToolCallIds.add(tid);
      }

      // 2. Send delta event — only when per-tool displayMode is 'full' (streaming args)
      if (outputMode === 'full' && displayMode === 'full' && tid && tc.args) {
        emitActivityEvent('node:progress', {
          workflowId,
          executionId,
          sessionId,
          parentExecutionId,
          nodeId,
          status: 'tool-input-delta',
          toolCallId: tid,
          toolName: tname,
          inputTextDelta: tc.args,
        });
      }
    },
  });

  logger.info(
    { nodeId, type: turnResult.type, toolCount: turnResult.toolCalls?.length },
    '[handleAITurn] One turn completed',
  );

  // Send tool-input-available for each tool call to provide the finalized input to UI
  if (outputMode !== 'silent' && turnResult.toolCalls?.length > 0) {
    for (const tc of turnResult.toolCalls) {
      const displayMode = getToolDisplayMode(tc.name);
      if (displayMode === 'name-only') continue; // suppress the finalized input event
      emitActivityEvent('node:progress', {
        workflowId,
        executionId,
        sessionId,
        parentExecutionId,
        nodeId,
        status: 'tool-input-available',
        toolCallId: tc.id,
        toolName: tc.name,
        input: (outputMode === 'full' && displayMode === 'full') ? tc.args : '',
      });
    }
  }
  // else {
  //   // Finalize the step signal
  //   emitActivityEvent('node:progress', {
  //     workflowId,
  //     executionId,
  //     nodeId,
  //     status: 'finish-step',
  //   });
  // }

  // 6. Return result. For final turns, apply tag extraction (think/intent/json) here in the
  // Activity (Node.js context), since workflows.js cannot use dynamic import() in the VM sandbox.
  let finalContent = turnResult.content || '';
  let parsedExtra = {};
  if (turnResult.type === 'final') {
    try {
      const { extractTags } = await import('../../utils/ai-parser.js');
      const parsed = extractTags(finalContent);
      finalContent = parsed.content || finalContent;
      parsedExtra = { intent: parsed.intent, json: parsed.json };
    } catch (e) {
      // ai-parser is optional, ignore failures
    }
  }

  return {
    type: turnResult.type,
    content: finalContent,
    thought: turnResult.thought || '',
    ...parsedExtra,
    toolCalls: turnResult.toolCalls || [],
    skillMap,
    rawAIMessage: {
      role: 'assistant',
      content: turnResult.content || '',
      thought: turnResult.thought || '',
      tool_calls: turnResult.toolCalls || [],
    },
    usage: turnResult.usage || {},
  };
};

/**
 * Specialized Activity for BlockNote AI.
 * Reuses the original BlockNoteAIService logic and UniversalGraphRunner
 * to ensure perfect compatibility with BlockNote's expected stream protocol.
 */
export const handleBlockNoteAction = async (data, workflowId) => {
  const {
    messages = [],
    toolDefinitions = [],
    userId,
    appId,
    executionId,
    parentExecutionId,
  } = data;

  try {
    const { injectDocumentStateMessages, aiDocumentFormats, toolDefinitionsToToolSet } =
      await import('@blocknote/xl-ai/server');
    const { runBlockNoteGraph } = await import('../../agent/core/buildBlockNoteGraph.js');
    const { UniversalGraphRunner } = await import('../../agent/core/UniversalGraphRunner.js');

    // 1. Process BlockNote messages (injects state/context)
    logger.info(
      { messagesCount: messages.length, hasTools: !!toolDefinitions },
      '[handleBlockNoteAction] Processing BlockNote messages',
    );

    if (!messages || messages.length === 0) {
      logger.warn(
        '[handleBlockNoteAction] No messages provided for BlockNote AI. Skipping processing.',
      );
      // Return empty result or throw a clear error
      return { success: true, result: '' };
    }

    const processedMessages = injectDocumentStateMessages(messages);
    const systemPrompt = aiDocumentFormats.html.systemPrompt;

    // 2. Wrap original logic in a mock graph for the runner
    const mockGraph = {
      streamEvents: (inputState) =>
        runBlockNoteGraph(
          processedMessages,
          toolDefinitionsToToolSet(toolDefinitions),
          systemPrompt,
          { userId, appId, taskId: inputState.taskId },
        ),
    };

    const runner = new UniversalGraphRunner(mockGraph);
    const stream = runner.run({ taskId: workflowId });

    for await (const event of stream) {
      // Forward standard events to the workflow
      emitActivityEvent('node:progress', {
        workflowId,
        executionId,
        nodeId: data.nodeId,
        parentExecutionId,
        ...event,
        status: event.type, // Map 'type' to 'status' for UnifiedChatService
      });
    }

    return { success: true };
  } catch (err) {
    logger.error({ err }, '[blocknote.activity] Failed');
    throw err;
  }
};
