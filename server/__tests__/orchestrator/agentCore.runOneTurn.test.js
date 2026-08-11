/**
 * Unit Tests: AgentCore.runOneTurn()
 *
 * Tests the new single-step LLM prediction method.
 * All LLM calls are mocked to avoid real API calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock createLLM ───────────────────────────────────────────────────────────
vi.mock('../../agent/llm/langchainAi.js', () => ({
  createLLM: vi.fn(),
}));

import { createLLM } from '../../agent/llm/langchainAi.js';
import AgentCore from '../../agent/core/AgentCore.js';

// Helper to build a mock streaming LLM
const buildMockLLM = (chunks) => ({
  bindTools: vi.fn().mockReturnThis(),
  stream: vi.fn().mockImplementation(async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  }),
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Test: Final text response ────────────────────────────────────────────────
describe('AgentCore.runOneTurn', () => {
  it('returns type=final when AI responds with plain text', async () => {
    const chunks = [
      { content: 'Hello ', response_metadata: {}, tool_call_chunks: [], concat: function(c) { return { ...this, content: this.content + c.content }; } },
      { content: 'world!', response_metadata: {}, tool_call_chunks: [], concat: function(c) { return { ...this, content: this.content + c.content }; } },
    ];

    createLLM.mockReturnValue(buildMockLLM(chunks));

    const result = await AgentCore.runOneTurn({
      messages: [{ role: 'user', content: 'Say hello' }],
      openAIFormattedTools: [],
      llmConfig: { provider: 'openai', userId: 'u1', orgId: 'o1', appId: 'a1' },
    });

    expect(result.type).toBe('final');
    expect(result.toolCalls).toHaveLength(0);
    expect(result.content).toContain('Hello');
  });

  // ─── Test: Tool call response ──────────────────────────────────────────────
  it('returns type=tool_call when AI responds with tool_calls', async () => {
    const fakeChunk = {
      content: '',
      response_metadata: {},
      tool_call_chunks: [],
      tool_calls: [{ name: 'recall_memory', args: { query: 'test query' }, id: 'tc_001' }],
      concat: function(c) { return this; },
    };

    createLLM.mockReturnValue(buildMockLLM([fakeChunk]));

    const result = await AgentCore.runOneTurn({
      messages: [{ role: 'user', content: 'What did I say last time?' }],
      openAIFormattedTools: [
        {
          type: 'function',
          function: {
            name: 'recall_memory',
            description: 'Search memories',
            parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
          },
        },
      ],
      llmConfig: { provider: 'openai', userId: 'u1', orgId: 'o1', appId: 'a1' },
    });

    expect(result.type).toBe('tool_call');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('recall_memory');
  });

  // ─── Test: Empty tool list ─────────────────────────────────────────────────
  it('does not call bindTools when no tools are provided', async () => {
    const mockLLM = buildMockLLM([
      { content: 'Answer', response_metadata: {}, tool_call_chunks: [], concat: function(c) { return this; } },
    ]);
    createLLM.mockReturnValue(mockLLM);

    await AgentCore.runOneTurn({
      messages: [{ role: 'user', content: 'Simple question' }],
      openAIFormattedTools: [], // no tools
      llmConfig: { provider: 'openai', userId: 'u1', orgId: 'o1', appId: 'a1' },
    });

    expect(mockLLM.bindTools).not.toHaveBeenCalled();
  });

  // ─── Test: Client tool detection ──────────────────────────────────────────
  it('returns type=client_tool when a tool is in clientTools list', async () => {
    const fakeChunk = {
      content: '',
      response_metadata: {},
      tool_call_chunks: [],
      tool_calls: [{ name: 'applyDocumentOperations', args: {}, id: 'tc_002' }],
      concat: function(c) { return this; },
    };
    createLLM.mockReturnValue(buildMockLLM([fakeChunk]));

    const result = await AgentCore.runOneTurn({
      messages: [{ role: 'user', content: 'Edit document' }],
      openAIFormattedTools: [
        { type: 'function', function: { name: 'applyDocumentOperations', description: 'Edit doc', parameters: {} } },
      ],
      clientTools: ['applyDocumentOperations'],
      llmConfig: { provider: 'openai', userId: 'u1', orgId: 'o1', appId: 'a1' },
    });

    expect(result.type).toBe('client_tool');
  });

  // ─── Test: Streaming callbacks ─────────────────────────────────────────────
  it('calls onTextDelta for each text chunk', async () => {
    // Use simple string content chunks that stream one by one
    const makeChunk = (text) => ({
      content: text,
      additional_kwargs: {},
      response_metadata: {},
      tool_call_chunks: [],
      tool_calls: [],
      concat: function(other) {
        return { ...this, content: this.content + (other.content || '') };
      },
    });

    createLLM.mockReturnValue(buildMockLLM([makeChunk('Part1'), makeChunk('Part2')]));

    const textDeltas = [];
    await AgentCore.runOneTurn({
      messages: [{ role: 'user', content: 'hi' }],
      openAIFormattedTools: [],
      llmConfig: { provider: 'openai', userId: 'u1', orgId: 'o1', appId: 'a1' },
      onTextDelta: (text) => textDeltas.push(text),
    });

    expect(textDeltas.some(t => t.includes('Part1'))).toBe(true);
    expect(textDeltas.some(t => t.includes('Part2'))).toBe(true);
  });
});
