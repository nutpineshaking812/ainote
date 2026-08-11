import { SystemMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { createLLM } from '../llm/langchainAi.js';
import { logger } from '../../config/logger.js';
import trace from '../utils/trace_logger.js';

const MAX_TOOL_CALL_ROUNDS = 10;

/**
 * AgentCore
 * Pure LLM engine: responsible for creating the model, binding tools,
 * and running the tool-call loop. Contains NO business logic.
 */
class AgentCore {
  /**
   * Run a tool-call loop until the LLM produces a final text response.
   */
  async run({
    messages,
    openAIFormattedTools = [],
    executableTools = new Map(),
    llmConfig = {},
    onToolCall = null,
    onTextDelta = null,
    onThinkingDelta = null,
    onToolStream = null,
    clientTools = [],
    toolChoice = null,
    maxToolRounds = MAX_TOOL_CALL_ROUNDS,
    sequentialTools = false,
    maxToolOutputLength = 20000,
    traceRole = 'LLM', // Role for TraceLogger (e.g., PARENT, EXPERT)
  }) {
    const { provider, userId, orgId, appId, runName, taskId } = llmConfig;
    const correlationId = taskId || appId || 'unknown';
    const localMessages = [...messages];

    const llm = createLLM(provider, {
      runName: runName || 'skill-agent',
      taskId,
      userId,
      orgId,
      appId,
      enable_thinking: false,
      enable_search: false,
    });

    const model =
      openAIFormattedTools.length > 0
        ? llm.bindTools(openAIFormattedTools, {
            tool_choice: toolChoice === 'required' ? 'required' : toolChoice,
          })
        : llm;

    const internalStream = async (msgs) => {
      let aggregated = null;
      const stream = await model.stream(msgs);
      for await (const chunk of stream) {
        if (!aggregated) {
          trace.append(correlationId, traceRole, `[${runName}] First LLM chunk received`);
        }

        // Handle thinking content
        const thinking =
          chunk.additional_kwargs?.reasoning_content ||
          chunk.additional_kwargs?.thinking ||
          chunk.lc_kwargs?.additional_kwargs?.reasoning_content ||
          chunk.lc_kwargs?.additional_kwargs?.thinking;

        if (onThinkingDelta && thinking) {
          onThinkingDelta(thinking);
          trace.thought(correlationId, traceRole, thinking);
        }

        // Send content delta to caller
        let text = '';
        if (typeof chunk.content === 'string') {
          text = chunk.content;
        } else if (Array.isArray(chunk.content)) {
          text = chunk.content
            .filter((c) => c.type === 'text')
            .map((c) => c.text)
            .join('');
        }

        if (onTextDelta && text) onTextDelta(text);
        if (onToolStream && chunk.tool_call_chunks?.length > 0)
          onToolStream(chunk.tool_call_chunks, chunk);

        if (!aggregated) {
          aggregated = chunk;
        } else {
          try {
            aggregated = aggregated.concat(chunk);
          } catch (e) {
            // silent fail
          }
        }
      }
      return aggregated || { content: '' };
    };

    let response = await internalStream(localMessages);
    trace.append(
      correlationId,
      traceRole,
      `[${runName}] Response received (Tool Calls: ${response.tool_calls?.length || 0})`,
    );

    let round = 0;
    const callHistory = new Set();

    while (response.tool_calls?.length > 0 && round < maxToolRounds) {
      round++;
      const toolNames = response.tool_calls.map((tc) => tc.name);
      const signature = JSON.stringify(
        response.tool_calls.map((tc) => ({ n: tc.name, a: tc.args })),
      );

      if (callHistory.has(signature)) {
        logger.warn({ signature, round }, `[AgentCore][${runName}] Loop detected. Stopping.`);
        break;
      }
      callHistory.add(signature);

      trace.append(
        correlationId,
        traceRole,
        `Round ${round}: ${response.tool_calls.length} tool calls Requested`,
      );

      const hasClientTool = response.tool_calls.some((tc) => clientTools.includes(tc.name));
      if (hasClientTool) {
        return {
          content: response.content || '',
          usage: this._normalizeUsage(response.response_metadata || {}),
          messages: localMessages,
          toolCalls: response.tool_calls,
        };
      }

      localMessages.push(response);

      const runTool = async (toolCall) => {
        const tool = executableTools.get(toolCall.name);
        if (!tool && !onToolCall) {
          return new ToolMessage({
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Tool "${toolCall.name}" not found` }),
          });
        }

        let result;
        try {
          const context = { userId, orgId, appId, taskId, onTextDelta, onThinkingDelta };
          trace.tool(correlationId, traceRole, toolCall.name, toolCall.args);

          result = onToolCall
            ? await onToolCall(toolCall, tool)
            : await tool.execute(toolCall.args, context);

          trace.result(correlationId, traceRole, toolCall.name, result);
        } catch (err) {
          logger.error(
            { err, toolName: toolCall.name },
            `[AgentCore][${runName}] Execution failed`,
          );
          result = { error: err.message };
        }

        let contentStr = JSON.stringify(result);
        if (contentStr.length > maxToolOutputLength) {
          const originalLen = contentStr.length;
          contentStr =
            contentStr.substring(0, maxToolOutputLength) +
            `... [Output truncated from ${originalLen} chars]`;
        }

        return new ToolMessage({
          tool_call_id: toolCall.id,
          content: contentStr,
        });
      };

      let toolResults;
      if (sequentialTools) {
        toolResults = [];
        for (const tc of response.tool_calls) {
          toolResults.push(await runTool(tc));
        }
      } else {
        toolResults = await Promise.all(response.tool_calls.map(runTool));
      }

      localMessages.push(...toolResults);
      response = await internalStream(localMessages);
      trace.append(
        correlationId,
        traceRole,
        `Round ${round} response received (Tool Calls: ${response.tool_calls?.length || 0})`,
      );
    }

    trace.append(
      correlationId,
      traceRole,
      `Execution completed in ${round} rounds. Results: ${response.content?.substring(0, 50)}...`,
    );

    return {
      content: response.content || '',
      usage: this._normalizeUsage(response.response_metadata || {}),
      messages: localMessages,
    };
  }

  _normalizeUsage(metadata) {
    const raw = metadata.tokenUsage || metadata.usage || {};
    return {
      promptTokens: raw.prompt_tokens || raw.input_tokens || 0,
      completionTokens: raw.completion_tokens || raw.output_tokens || 0,
      totalTokens: raw.total_tokens || 0,
    };
  }

  async runOneTurn({
    messages,
    openAIFormattedTools = [],
    llmConfig = {},
    onTextDelta = null,
    onThinkingDelta = null,
    onToolStream = null,
    clientTools = [],
    toolChoice = null,
    jsonMode = false,
    enableThinking = false,
    enableSearch = false,
    traceRole = 'LLM', // New parameter
  }) {
    const { provider, userId, orgId, appId, runName, taskId } = llmConfig;
    const correlationId = taskId || appId || 'unknown';

    const llm = createLLM(provider, {
      runName: runName || 'agent-turn',
      taskId,
      userId,
      orgId,
      appId,
      enable_thinking: enableThinking,
      enable_search: enableSearch,
      jsonMode,
    });

    const model =
      openAIFormattedTools.length > 0
        ? llm.bindTools(openAIFormattedTools, {
            tool_choice: toolChoice === 'required' ? 'required' : toolChoice,
          })
        : llm;

    trace.append(correlationId, traceRole, `[${runName}] Starting Prediction (One Turn)`);

    let aggregated = null;
    let thoughtAccumulator = '';
    const stream = await model.stream(messages);
    for await (const chunk of stream) {
      if (!aggregated) {
        trace.append(correlationId, traceRole, `[${runName}] First LLM chunk received`);
      }

      // Defensive reasoning content extraction
      const thinking =
        chunk.additional_kwargs?.reasoning_content ||
        chunk.additional_kwargs?.thinking ||
        chunk.additional_kwargs?.reasoning ||
        chunk.lc_kwargs?.additional_kwargs?.reasoning_content ||
        chunk.lc_kwargs?.additional_kwargs?.thinking ||
        chunk.lc_kwargs?.additional_kwargs?.reasoning;

      if (thinking) {
        thoughtAccumulator += thinking;
        if (onThinkingDelta) {
          onThinkingDelta(thinking);
          trace.thought(correlationId, traceRole, thinking);
        }
      }

      let text = '';
      if (typeof chunk.content === 'string') {
        text = chunk.content;
      } else if (Array.isArray(chunk.content)) {
        text = chunk.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('');
      }

      if (onTextDelta && text) onTextDelta(text);
      if (onToolStream && chunk.tool_call_chunks?.length > 0) {
        console.log('[AgentCore·onToolStream] chunks:', JSON.stringify(chunk.tool_call_chunks));
        onToolStream(chunk.tool_call_chunks, chunk);
      }

      if (!aggregated) {
        aggregated = chunk;
      } else {
        try {
          aggregated = aggregated.concat(chunk);
        } catch (e) {
          // ignore
        }
      }
    }

    const response = aggregated || { content: '' };
    const usage = this._normalizeUsage(response.response_metadata || {});

    // Use our manual accumulator for better reliability in streams
    const thought = thoughtAccumulator || '';

    trace.append(
      correlationId,
      traceRole,
      `Turn completed. (Tool Calls: ${response.tool_calls?.length || 0}) Result: ${response.content?.substring(0, 50)}...`,
    );

    const baseResult = {
      content: response.content || '',
      toolCalls: response.tool_calls || [],
      rawResponse: response,
      usage,
      thought,
    };

    if (response.tool_calls?.length > 0) {
      const hasClientTool = response.tool_calls.some((tc) => clientTools.includes(tc.name));
      return {
        ...baseResult,
        type: hasClientTool ? 'client_tool' : 'tool_call',
      };
    }

    return {
      ...baseResult,
      type: 'final',
    };
  }
}

export default new AgentCore();
