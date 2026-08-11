/**
 * Tests: workflow-engine/runner.js — runGraph()
 *
 * Tests the graph traversal engine in isolation by providing:
 *   - Simple linear graphs
 *   - if/for branching
 *   - Dependency (addon/slot) resolution
 *   - Circuit breaker (max steps)
 *   - Node error propagation + cleanup
 *
 * All Activity calls are mocked inside the 'acts' bundle.
 * Temporal workflow APIs (executeChild, condition, workflowInfo) are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Temporal mocks (must be before importing runner) ────────────────────────
vi.mock('@temporalio/workflow', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  workflowInfo: vi.fn(() => ({ workflowId: 'test-wf-001' })),
  condition: vi.fn(),
  executeChild: vi.fn(),
  startChild: vi.fn(),
}));

import { runGraph } from '../../temporal/workflow-engine/runner.js';

// ─── Activity bundle factory ──────────────────────────────────────────────────
function makeActs(overrides = {}) {
  return {
    emitActivityEvent: vi.fn().mockResolvedValue(undefined),
    handleCurl: vi.fn().mockResolvedValue({ status: 200 }),
    handleAITurn: vi.fn().mockResolvedValue({
      type: 'final', content: 'AI response', toolCalls: [], rawAIMessage: {}, usage: {}, skillMap: {},
    }),
    executeSkillTool: vi.fn().mockResolvedValue('skill output'),
    handleBlockNoteAction: vi.fn().mockResolvedValue({}),
    handleSkillAction: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function makeLocalActs(overrides = {}) {
  return {
    emitActivityEvent: vi.fn().mockResolvedValue(undefined),
    handleNotification: vi.fn().mockResolvedValue({ sent: true }),
    handleLog: vi.fn().mockResolvedValue({ logged: true }),
    handleSendSSEEvent: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

const baseCtx = {
  triggerData: { appId: 'app-001', orgId: 'org-001', triggeredBy: 'user-001' },
  workflowData: { _id: 'wf-001', organizationId: 'org-001', appId: 'app-001' },
  executionId: 'exec-001',
  executeChildFn: vi.fn(),
  startChildFn: vi.fn(),
  conditionFn: vi.fn(),
  latestFormDataRef: { value: null },
  pendingSignalResults: new Map(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Graph builder helpers ────────────────────────────────────────────────────
function node(id, type, data = {}) {
  return { id, type, data };
}
function edge(source, target, sourceHandle = null, targetHandle = null) {
  return { id: `${source}->${target}`, source, target, sourceHandle, targetHandle };
}

// ──────────────────────────────────────────────────────────────────────────────
describe('runGraph — linear flow', () => {

  it('runs a minimal trigger-only graph', async () => {
    const nodes = [node('n1', 'trigger')];
    const edges = [];

    const results = await runGraph({
      ...baseCtx,
      nodes, edges,
      acts: makeActs(),
      localActs: makeLocalActs(),
    });

    expect(results['n1']).toBeDefined();
    expect(results['n1'].result.triggeredAt).toBeDefined();
  });

  it('executes trigger → notification → log in order', async () => {
    const callOrder = [];
    // notification and log go through localActs
    const localActs = makeLocalActs({
      handleNotification: vi.fn().mockImplementation(async () => {
        callOrder.push('notification');
        return { sent: true };
      }),
      handleLog: vi.fn().mockImplementation(async () => {
        callOrder.push('log');
        return { logged: true };
      }),
    });

    const nodes = [
      node('trigger', 'trigger'),
      node('notif', 'notification'),
      node('log', 'log'),
    ];
    const edges = [
      edge('trigger', 'notif'),
      edge('notif', 'log'),
    ];

    await runGraph({ ...baseCtx, nodes, edges, acts: makeActs(), localActs });

    expect(callOrder).toEqual(['notification', 'log']);
  });

  it('stops gracefully when no outgoing edge from a node', async () => {
    const nodes = [node('trigger', 'trigger'), node('end', 'notification')];
    const edges = [edge('trigger', 'end')];
    // No edge from 'end' → traversal stops
    const results = await runGraph({ ...baseCtx, nodes, edges, acts: makeActs(), localActs: makeLocalActs() });
    expect(results['trigger']).toBeDefined();
    expect(results['end']).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('runGraph — if branching', () => {

  async function runIfGraph(triggerData, actsOverrides = {}, ignored = {}, localActsOverrides = {}) {
    const nodes = [
      node('trigger', 'trigger'),
      node('cond', 'if', { condition: '{{trigger.score}} > 5' }),
      node('trueNode', 'notification'),
      node('falseNode', 'log'),
    ];
    const edges = [
      edge('trigger', 'cond'),
      edge('cond', 'trueNode', 'true'),
      edge('cond', 'falseNode', 'false'),
    ];

    return runGraph({
      ...baseCtx,
      triggerData: { ...baseCtx.triggerData, ...triggerData },
      nodes, edges,
      acts: makeActs(actsOverrides),
      localActs: makeLocalActs(localActsOverrides),
    });
  }

  it('takes the true branch when condition is met', async () => {
    // notification goes through localActs
    const localActs = makeLocalActs({
      handleNotification: vi.fn().mockResolvedValue({ sent: true }),
    });
    const results = await runIfGraph({ score: 10 }, {}, {}, localActs);
    expect(results['trueNode']).toBeDefined();
    expect(results['falseNode']).toBeUndefined();
    expect(localActs.handleNotification).toHaveBeenCalledTimes(1);
  });

  it('takes the false branch when condition is not met', async () => {
    const handleLog = vi.fn().mockResolvedValue({ logged: true });
    const results = await runIfGraph({ score: 2 }, {}, {});
    expect(results['falseNode']).toBeDefined();
    expect(results['trueNode']).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('runGraph — addon/slot dependency resolution', () => {

  it('executes addon node before main node', async () => {
    const callOrder = [];
    const acts = makeActs({
      handleCurl: vi.fn().mockImplementation(async () => {
        callOrder.push('curl-addon');
        return { data: 'fetched' };
      }),
    });
    const localActs = makeLocalActs({
      handleNotification: vi.fn().mockImplementation(async () => {
        callOrder.push('notification');
        return { sent: true };
      }),
    });

    // curl → notification (tool-slot dependency, not sequential)
    const nodes = [
      node('trigger', 'trigger'),
      node('curlNode', 'curl'),
      node('notifNode', 'notification'),
    ];
    const edges = [
      edge('trigger', 'notifNode'),
      { id: 'slot-edge', source: 'curlNode', target: 'notifNode', sourceHandle: null, targetHandle: 'some-slot' },
    ];

    await runGraph({ ...baseCtx, nodes, edges, acts, localActs });

    // curl-addon runs before notification
    expect(callOrder.indexOf('curl-addon')).toBeLessThan(callOrder.indexOf('notification'));
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('runGraph — circuit breaker', () => {

  it('throws when maxSteps is exceeded (infinite loop prevention)', async () => {
    // Create a loop: trigger → loopNode → loopNode → …
    const nodes = [
      node('trigger', 'trigger'),
      node('loopNode', 'notification'),
    ];
    // loop-in edge: loopNode → loopNode with targetHandle=loop-in (ignored by addon check)
    const edges = [
      edge('trigger', 'loopNode'),
      { id: 'loop', source: 'loopNode', target: 'loopNode', sourceHandle: null, targetHandle: null },
    ];

    await expect(
      runGraph({ ...baseCtx, nodes, edges, acts: makeActs(), localActs: makeLocalActs() }),
    ).rejects.toThrow('step limit exceeded');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('runGraph — error propagation', () => {

  it('emits node:error event and re-throws when a node Activity fails', async () => {
    const localActs = makeLocalActs({
      // notification goes through localActs
      handleNotification: vi.fn().mockRejectedValue(new Error('DB connection failed')),
    });

    const nodes = [node('trigger', 'trigger'), node('notif', 'notification')];
    const edges = [edge('trigger', 'notif')];

    await expect(
      runGraph({ ...baseCtx, nodes, edges, acts: makeActs(), localActs }),
    ).rejects.toThrow('DB connection failed');

    // Verify node:error was emitted
    const errorCalls = localActs.emitActivityEvent.mock.calls.filter(
      ([eventType]) => eventType === 'node:error',
    );
    expect(errorCalls.length).toBeGreaterThan(0);
    expect(errorCalls[0][1].error).toContain('DB connection failed');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('runGraph — mock node short-circuit', () => {

  it('returns mockData directly without calling Activity when isMock is true', async () => {
    const handleNotification = vi.fn();
    const acts = makeActs({ handleNotification });

    const nodes = [
      node('trigger', 'trigger'),
      node('notif', 'notification', { isMock: true, mockData: { mocked: true } }),
    ];
    const edges = [edge('trigger', 'notif')];

    const results = await runGraph({ ...baseCtx, nodes, edges, acts, localActs: makeLocalActs() });

    expect(results['notif'].result).toEqual({ mocked: true });
    expect(handleNotification).not.toHaveBeenCalled();
  });

  it('parses mockData JSON string when mockData looks like JSON', async () => {
    const nodes = [
      node('trigger', 'trigger'),
      node('log', 'log', { isMock: true, mockData: '{"value":42}' }),
    ];
    const edges = [edge('trigger', 'log')];

    const results = await runGraph({ ...baseCtx, nodes, edges, acts: makeActs(), localActs: makeLocalActs() });
    expect(results['log'].result).toEqual({ value: 42 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
describe('runGraph — node:start / node:success events', () => {

  it('emits node:start before and node:success after each node', async () => {
    const localActs = makeLocalActs();

    const nodes = [node('trigger', 'trigger'), node('end', 'notification')];
    const edges = [edge('trigger', 'end')];

    await runGraph({ ...baseCtx, nodes, edges, acts: makeActs(), localActs });

    const emitted = localActs.emitActivityEvent.mock.calls.map(([type]) => type);
    // Each node emits start and success
    expect(emitted.filter(e => e === 'node:start').length).toBeGreaterThanOrEqual(2);
    expect(emitted.filter(e => e === 'node:success').length).toBeGreaterThanOrEqual(2);
    // Start before success
    expect(emitted.indexOf('node:start')).toBeLessThan(emitted.indexOf('node:success'));
  });
});
