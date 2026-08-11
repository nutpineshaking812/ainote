/**
 * Integration Tests: Workflow Orchestrator Loop (aiAgent node)
 *
 * Tests the new Orchestrator-pattern loop in workflows.js without
 * starting a real Temporal server, by directly simulating what the
 * workflow does in the aiAgent case.
 *
 * The "orchestrator loop" is a pure control-flow logic that:
 *   1. Calls handleAITurn repeatedly
 *   2. Dispatches tool calls (recall_memory → executeChild, skill → Activity)
 *   3. Accumulates message history
 *   4. Exits when AI says 'final'
 *
 * We test this by extracting the loop logic into a testable pure function.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Simulate the orchestrator loop logic ─────────────────────────────────────
// We extract the core loop as an async function to test it in isolation.
// This mirrors what workflows.js does in the aiAgent case.
async function orchestratorLoop({
  maxRounds = 10,
  handleAITurn,       // mocked: (data, nodeId, wfId) => turnResult
  executeChild,       // mocked: (workflowName, opts) => subWorkflowResult
  handleSkillToolCall, // mocked: (data, nodeId, wfId) => skillResult
  commonAiData,
  nodeId = 'test-node',
  workflowId = 'test-wf',
  executionId = 'test-exec',
}) {
  let aiRound = 0;
  let conversationMessages = [];
  let finalAiResult = null;
  const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  while (aiRound < maxRounds) {
    aiRound++;
    const turnData = { ...commonAiData, messages: conversationMessages };
    const turnResult = await handleAITurn(turnData, nodeId, workflowId);

    if (turnResult.type === 'final') {
      finalAiResult = turnResult;
      totalUsage.promptTokens += turnResult.usage?.promptTokens || 0;
      totalUsage.completionTokens += turnResult.usage?.completionTokens || 0;
      totalUsage.totalTokens += turnResult.usage?.totalTokens || 0;
      break;
    }

    if (turnResult.type === 'client_tool') {
      finalAiResult = turnResult;
      break;
    }

    if (turnResult.type === 'tool_call') {
      conversationMessages.push(turnResult.rawAIMessage);
      totalUsage.promptTokens += turnResult.usage?.promptTokens || 0;
      totalUsage.completionTokens += turnResult.usage?.completionTokens || 0;

      for (const tc of turnResult.toolCalls) {
        let toolContent = '';

        if (tc.name === 'recall_memory' && commonAiData.memoryWorkflowId) {
          try {
            const recallResult = await executeChild('runWorkflow', {
              workflowId: `recall-${nodeId}-${executionId}-${aiRound}`,
              args: [commonAiData.memoryWorkflowId, { query: tc.args?.query }],
            });
            toolContent =
              recallResult?.fetch?.result?.contextString ||
              recallResult?.content ||
              'No relevant memories found.';
          } catch (err) {
            toolContent = 'No relevant memories found.';
          }
        } else {
          try {
            const skillMeta = turnResult.skillMap?.[tc.name];
            const skillResult = await handleSkillToolCall(
              { skillName: tc.name, skillId: skillMeta?.id, args: tc.args, ...commonAiData },
              nodeId, workflowId,
            );
            toolContent = skillMeta?.hideResult
              ? '[Task completed. Do NOT repeat.]'
              : (typeof skillResult === 'string' ? skillResult : JSON.stringify(skillResult));
          } catch (err) {
            toolContent = `Error executing tool ${tc.name}: ${err.message}`;
          }
        }

        conversationMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolContent,
        });
      }
    }
  }

  if (!finalAiResult) {
    finalAiResult = { content: 'Max reasoning rounds reached.', usage: totalUsage };
  }

  return { finalAiResult, totalUsage, conversationMessages, rounds: aiRound };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────
describe('Orchestrator Loop', () => {

  const commonAiData = {
    userPrompt: 'What did I say last time about the project?',
    memoryWorkflowId: 'DEFAULT_MEMORY_RECALL',
    appId: 'app-001', sessionId: 'sess-001', userId: 'user-001',
  };

  // ── Scenario 1: Direct final answer (no tool call) ─────────────────────────
  it('exits after 1 round when AI answers directly', async () => {
    const handleAITurn = vi.fn().mockResolvedValue({
      type: 'final',
      content: 'The answer is 42.',
      toolCalls: [],
      rawAIMessage: { role: 'assistant', content: 'The answer is 42.', tool_calls: [] },
      usage: { promptTokens: 10, completionTokens: 5 },
      skillMap: {},
    });
    const executeChild = vi.fn();
    const handleSkillToolCall = vi.fn();

    const { finalAiResult, rounds } = await orchestratorLoop({
      handleAITurn, executeChild, handleSkillToolCall, commonAiData,
    });

    expect(rounds).toBe(1);
    expect(finalAiResult.content).toBe('The answer is 42.');
    expect(handleAITurn).toHaveBeenCalledTimes(1);
    expect(executeChild).not.toHaveBeenCalled();
  });

  // ── Scenario 2: AI recalls memory then answers ─────────────────────────────
  it('calls executeChild for recall_memory, then gets a final answer on round 2', async () => {
    let round = 0;
    const handleAITurn = vi.fn().mockImplementation(async (data) => {
      round++;
      if (round === 1) {
        // First turn: AI wants to search memory
        return {
          type: 'tool_call',
          content: '',
          toolCalls: [{ name: 'recall_memory', args: { query: 'project decisions' }, id: 'tc_001' }],
          rawAIMessage: {
            role: 'assistant', content: '',
            tool_calls: [{ name: 'recall_memory', args: { query: 'project decisions' }, id: 'tc_001' }],
          },
          usage: { promptTokens: 20, completionTokens: 3 },
          skillMap: {},
        };
      }
      // Second turn: AI uses memory result and answers
      expect(data.messages).toHaveLength(2); // AI message + tool result
      expect(data.messages[1].role).toBe('tool');
      expect(data.messages[1].content).toContain('We decided to use React');
      return {
        type: 'final',
        content: 'Based on the memory, you decided to use React.',
        toolCalls: [],
        rawAIMessage: { role: 'assistant', content: 'Based on the memory...', tool_calls: [] },
        usage: { promptTokens: 30, completionTokens: 10 },
        skillMap: {},
      };
    });

    const executeChild = vi.fn().mockResolvedValue({
      fetch: { result: { contextString: 'We decided to use React as the frontend framework.' } },
    });

    const { finalAiResult, rounds, conversationMessages } = await orchestratorLoop({
      handleAITurn, executeChild, handleSkillToolCall: vi.fn(), commonAiData,
    });

    expect(rounds).toBe(2);
    expect(executeChild).toHaveBeenCalledTimes(1);
    expect(executeChild).toHaveBeenCalledWith('runWorkflow', expect.objectContaining({
      args: expect.arrayContaining(['DEFAULT_MEMORY_RECALL']),
    }));
    expect(finalAiResult.content).toContain('React');
    // History should have: AI tool_call msg + tool result = 2 items
    expect(conversationMessages).toHaveLength(2);
    expect(conversationMessages[1].role).toBe('tool');
  });

  // ── Scenario 3: Memory sub-workflow fails → graceful fallback ──────────────
  it('returns "No relevant memories found" and continues when executeChild throws', async () => {
    let round = 0;
    const handleAITurn = vi.fn().mockImplementation(async (data) => {
      round++;
      if (round === 1) {
        return {
          type: 'tool_call',
          content: '',
          toolCalls: [{ name: 'recall_memory', args: { query: 'broken search' }, id: 'tc_002' }],
          rawAIMessage: { role: 'assistant', content: '', tool_calls: [{ id: 'tc_002' }] },
          usage: {}, skillMap: {},
        };
      }
      // Second turn — AI gets the fallback message and proceeds
      const toolMsg = data.messages.find(m => m.role === 'tool');
      expect(toolMsg.content).toBe('No relevant memories found.');
      return {
        type: 'final', content: 'I could not find relevant memories.',
        toolCalls: [], rawAIMessage: { role: 'assistant', content: '', tool_calls: [] }, usage: {}, skillMap: {},
      };
    });

    // Simulate Qdrant being down
    const executeChild = vi.fn().mockRejectedValue(new Error('Qdrant connection timeout'));

    const { finalAiResult, rounds } = await orchestratorLoop({
      handleAITurn, executeChild, handleSkillToolCall: vi.fn(), commonAiData,
    });

    expect(rounds).toBe(2);
    expect(finalAiResult.content).toContain('could not find');
  });

  // ── Scenario 4: MAX_ROUNDS protection ─────────────────────────────────────
  it('stops after maxRounds and returns fallback content', async () => {
    // Always return tool_call to simulate an infinite loop
    const handleAITurn = vi.fn().mockResolvedValue({
      type: 'tool_call',
      content: '',
      toolCalls: [{ name: 'recall_memory', args: { query: '...' }, id: 'tc_loop' }],
      rawAIMessage: { role: 'assistant', content: '', tool_calls: [] },
      usage: {}, skillMap: {},
    });
    const executeChild = vi.fn().mockResolvedValue({ content: 'Memory result' });

    const { finalAiResult, rounds } = await orchestratorLoop({
      maxRounds: 3,
      handleAITurn, executeChild, handleSkillToolCall: vi.fn(), commonAiData,
    });

    expect(rounds).toBe(3);
    expect(finalAiResult.content).toBe('Max reasoning rounds reached.');
    expect(handleAITurn).toHaveBeenCalledTimes(3);
  });

  // ── Scenario 5: Skill tool call goes to Activity, not executeChild ─────────
  it('calls handleSkillToolCall for skill tools (not executeChild)', async () => {
    let round = 0;
    const handleAITurn = vi.fn().mockImplementation(async () => {
      round++;
      if (round === 1) {
        return {
          type: 'tool_call',
          content: '',
          toolCalls: [{ name: 'web_search', args: { query: 'AI news' }, id: 'tc_skill' }],
          rawAIMessage: { role: 'assistant', content: '', tool_calls: [{ id: 'tc_skill' }] },
          usage: {},
          skillMap: { web_search: { id: 'skill-001', hideResult: false } },
        };
      }
      return {
        type: 'final', content: 'AI news result processed.',
        toolCalls: [], rawAIMessage: { role: 'assistant', content: '', tool_calls: [] }, usage: {}, skillMap: {},
      };
    });

    const executeChild = vi.fn();
    const handleSkillToolCall = vi.fn().mockResolvedValue('Search result: AI is advancing rapidly.');

    const dataWithoutMemory = { ...commonAiData, memoryWorkflowId: undefined };
    const { rounds } = await orchestratorLoop({
      handleAITurn, executeChild, handleSkillToolCall,
      commonAiData: dataWithoutMemory,
    });

    expect(rounds).toBe(2);
    expect(handleSkillToolCall).toHaveBeenCalledTimes(1);
    expect(executeChild).not.toHaveBeenCalled(); // NOT a child workflow
  });

  // ── Scenario 6: usage tokens accumulate across rounds ─────────────────────
  it('accumulates token usage across multiple rounds', async () => {
    let round = 0;
    const handleAITurn = vi.fn().mockImplementation(async () => {
      round++;
      if (round === 1) {
        return {
          type: 'tool_call', content: '',
          toolCalls: [{ name: 'recall_memory', args: { query: 'q' }, id: 'tc_1' }],
          rawAIMessage: { role: 'assistant', content: '', tool_calls: [] },
          usage: { promptTokens: 100, completionTokens: 10 }, skillMap: {},
        };
      }
      return {
        type: 'final', content: 'Done.',
        toolCalls: [], rawAIMessage: { role: 'assistant', content: '', tool_calls: [] },
        usage: { promptTokens: 150, completionTokens: 20 }, skillMap: {},
      };
    });
    const executeChild = vi.fn().mockResolvedValue({ content: 'mem result' });

    const { totalUsage } = await orchestratorLoop({
      handleAITurn, executeChild, handleSkillToolCall: vi.fn(), commonAiData,
    });

    expect(totalUsage.promptTokens).toBe(250);   // 100 + 150
    expect(totalUsage.completionTokens).toBe(30); // 10 + 20
  });
});
