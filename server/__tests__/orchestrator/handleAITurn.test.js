/**
 * Integration Tests: handleAITurn Activity
 *
 * Tests the new single-turn AI Activity that powers the Orchestrator loop.
 * Mocks: skillService, AgentCore, emitActivityEvent, ai-parser
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock AgentCore singleton
vi.mock('../../agent/core/AgentCore.js', () => ({
  default: {
    runOneTurn: vi.fn(),
  },
}));

// Mock skillService
vi.mock('../../services/skill.service.js', () => ({
  default: {
    getAvailableSkills: vi.fn().mockResolvedValue([]),
  },
}));

// Mock emitActivityEvent (just a no-op in tests)
vi.mock('../../temporal/activities/system.activity.js', () => ({
  emitActivityEvent: vi.fn(),
}));

// Mock @temporalio/activity's Context
vi.mock('@temporalio/activity', () => ({
  ApplicationFailure: { create: vi.fn((opts) => new Error(opts.message)) },
  Context: { current: vi.fn(() => ({ heartbeat: vi.fn() })) },
}));

// Mock ai-parser
vi.mock('../../utils/ai-parser.js', () => ({
  extractTags: vi.fn((content) => ({ content, intent: null, json: null })),
}));

// Mock tool index
vi.mock('../../agent/tools/index.js', () => ({
  getGlobalTools: vi.fn(() => []),
}));

vi.mock('../../agent/utils/tool_utils.js', () => ({
  openAITools: vi.fn(() => []),
}));

import AgentCore from '../../agent/core/AgentCore.js';
import { handleAITurn } from '../../temporal/activities/ai.activity.js';

// ─── Shared test data ─────────────────────────────────────────────────────────
const baseData = {
  prompt: 'You are a helpful assistant.',
  userPrompt: 'What is 2+2?',
  model: 'openai',
  userId: 'user-001',
  orgId: 'org-001',
  appId: 'app-001',
  executionId: 'exec-001',
  sessionId: 'session-001',
  skillIds: [],
  messages: [], // empty: first turn
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Test Suite ───────────────────────────────────────────────────────────────
describe('handleAITurn Activity', () => {
  // ── Scenario 1: Simple final answer ────────────────────────────────────────
  it('returns type=final with content when AI gives a direct answer', async () => {
    AgentCore.runOneTurn.mockResolvedValue({
      type: 'final',
      content: '2+2 equals 4.',
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      rawResponse: {},
    });

    const result = await handleAITurn(baseData, 'node-1', 'wf-001');

    expect(result.type).toBe('final');
    expect(result.content).toContain('4');
    expect(result.rawAIMessage.role).toBe('assistant');
    expect(result.usage.promptTokens).toBe(10);
  });

  // ── Scenario 2: AI wants to recall memory ─────────────────────────────────
  it('returns type=tool_call with recall_memory when AI needs memory context', async () => {
    AgentCore.runOneTurn.mockResolvedValue({
      type: 'tool_call',
      content: '',
      toolCalls: [{ name: 'recall_memory', args: { query: 'user preferences' }, id: 'tc_abc' }],
      usage: { promptTokens: 20, completionTokens: 3, totalTokens: 23 },
      rawResponse: {},
    });

    const data = { ...baseData, memoryWorkflowId: 'DEFAULT_MEMORY_RECALL' };
    const result = await handleAITurn(data, 'node-1', 'wf-001');

    expect(result.type).toBe('tool_call');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('recall_memory');
    // rawAIMessage should carry the tool_calls for history management
    expect(result.rawAIMessage.tool_calls).toHaveLength(1);
  });

  // ── Scenario 3: extractTags is applied for final responses ─────────────────
  it('applies extractTags on final content before returning', async () => {
    const { extractTags } = await import('../../utils/ai-parser.js');
    extractTags.mockReturnValue({
      content: 'The answer is 4.',
      intent: { action: 'answer' },
      json: null,
    });

    AgentCore.runOneTurn.mockResolvedValue({
      type: 'final',
      content: '<intent>answer</intent>The answer is 4.',
      toolCalls: [],
      usage: {},
      rawResponse: {},
    });

    const result = await handleAITurn(baseData, 'node-1', 'wf-001');

    expect(extractTags).toHaveBeenCalled();
    expect(result.content).toBe('The answer is 4.');
    expect(result.intent).toEqual({ action: 'answer' });
  });

  // ── Scenario 4: extractTags NOT applied for tool_call responses ────────────
  it('does NOT call extractTags for tool_call type responses', async () => {
    const { extractTags } = await import('../../utils/ai-parser.js');

    AgentCore.runOneTurn.mockResolvedValue({
      type: 'tool_call',
      content: '',
      toolCalls: [{ name: 'recall_memory', args: { query: 'test' }, id: 'tc_x' }],
      usage: {},
      rawResponse: {},
    });

    await handleAITurn(
      { ...baseData, memoryWorkflowId: 'DEFAULT_MEMORY_RECALL' },
      'node-1',
      'wf-001',
    );

    expect(extractTags).not.toHaveBeenCalled();
  });

  // ── Scenario 5: memory tool injected when memoryWorkflowId present ─────────
  it('injects recall_memory tool definition when memoryWorkflowId is configured', async () => {
    AgentCore.runOneTurn.mockResolvedValue({
      type: 'final',
      content: 'ok',
      toolCalls: [],
      usage: {},
      rawResponse: {},
    });

    const data = { ...baseData, memoryWorkflowId: 'DEFAULT_MEMORY_RECALL' };
    await handleAITurn(data, 'node-1', 'wf-001');

    // Verify that runOneTurn was called with a tools list containing recall_memory
    const callArgs = AgentCore.runOneTurn.mock.calls[0][0];
    const memoryTool = callArgs.openAIFormattedTools.find(
      (t) => t.function?.name === 'recall_memory',
    );
    expect(memoryTool).toBeDefined();
    expect(memoryTool.function.parameters.required).toContain('query');
  });

  // ── Scenario 6: No memory tool when no memoryWorkflowId ───────────────────
  it('does NOT inject recall_memory tool when memoryWorkflowId is absent', async () => {
    AgentCore.runOneTurn.mockResolvedValue({
      type: 'final',
      content: 'ok',
      toolCalls: [],
      usage: {},
      rawResponse: {},
    });

    await handleAITurn(baseData, 'node-1', 'wf-001');

    const callArgs = AgentCore.runOneTurn.mock.calls[0][0];
    const memoryTool = callArgs.openAIFormattedTools.find(
      (t) => t.function?.name === 'recall_memory',
    );
    expect(memoryTool).toBeUndefined();
  });

  // ── Scenario 7: Continues from existing message history ───────────────────
  it('uses existing messages directly without rebuilding when messages array is not empty', async () => {
    AgentCore.runOneTurn.mockResolvedValue({
      type: 'final',
      content: 'Continuing.',
      toolCalls: [],
      usage: {},
      rawResponse: {},
    });

    const existingMessages = [
      { role: 'user', content: 'History message 1' },
      { role: 'assistant', content: 'History reply' },
      { role: 'tool', tool_call_id: 'tc_1', content: 'Memory result here' },
    ];

    const data = { ...baseData, messages: existingMessages };
    await handleAITurn(data, 'node-1', 'wf-001');

    // The messages passed to runOneTurn should contain the mapped existing messages
    const callArgs = AgentCore.runOneTurn.mock.calls[0][0];
    expect(callArgs.messages.slice(-3)).toEqual([
      new HumanMessage('History message 1'),
      new AIMessage({ content: 'History reply', tool_calls: [] }),
      new ToolMessage({ content: 'Memory result here', tool_call_id: 'tc_1' }),
    ]);
  });
});
