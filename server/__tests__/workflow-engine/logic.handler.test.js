/**
 * Tests: workflow-engine/nodes/logic.handler.js
 *
 * Tests if/while/for/trigger/waitUpdate handlers with mocked ctx.
 * These are pure deterministic control-flow functions — no Activity calls involved.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleIf,
  handleWhile,
  handleFor,
  handleWaitUpdate,
  handleTrigger,
} from '../../temporal/workflow-engine/nodes/logic.handler.js';

// ─── Mock @temporalio/workflow so evaluateCondition's log calls don't crash ───
vi.mock('@temporalio/workflow', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeNodeResults(obj) {
  return new Map(Object.entries(obj).map(([k, v]) => [k, { result: v, resolvedConfig: {} }]));
}

function makeCtx(overrides = {}) {
  return {
    node: { id: 'test-node' },
    nodes: [],
    edges: [],
    nodeResults: new Map(),
    triggerData: {},
    loopStates: new Map(),
    latestFormDataRef: { value: null },
    condition: vi.fn(),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

// ─── handleIf ────────────────────────────────────────────────────────────────
describe('handleIf', () => {
  it('returns nextHandleId=true when condition is truthy', async () => {
    const ctx = makeCtx({ triggerData: { score: 10 } });
    const { result, nextHandleId } = await handleIf({ condition: '{{trigger.score}} > 5' }, ctx);
    expect(result.evaluation).toBe(true);
    expect(nextHandleId).toBe('true');
  });

  it('returns nextHandleId=false when condition is falsy', async () => {
    const ctx = makeCtx({ triggerData: { score: 3 } });
    const { result, nextHandleId } = await handleIf({ condition: '{{trigger.score}} > 5' }, ctx);
    expect(result.evaluation).toBe(false);
    expect(nextHandleId).toBe('false');
  });

  it('returns false for empty condition expression', async () => {
    const ctx = makeCtx();
    const { result, nextHandleId } = await handleIf({ condition: '' }, ctx);
    expect(result.evaluation).toBe(false);
    expect(nextHandleId).toBe('false');
  });
});

// ─── handleWhile ─────────────────────────────────────────────────────────────
describe('handleWhile', () => {
  it('returns nextHandleId=loop when condition is true', async () => {
    const ctx = makeCtx({ triggerData: { keepGoing: true } });
    const { nextHandleId } = await handleWhile(
      { condition: '{{trigger.keepGoing}} === true' },
      ctx,
    );
    expect(nextHandleId).toBe('loop');
  });

  it('returns nextHandleId=exit when condition is false', async () => {
    const ctx = makeCtx({ triggerData: { keepGoing: false } });
    const { nextHandleId } = await handleWhile(
      { condition: '{{trigger.keepGoing}} === true' },
      ctx,
    );
    expect(nextHandleId).toBe('exit');
  });
});

// ─── handleFor ───────────────────────────────────────────────────────────────
describe('handleFor', () => {
  it('iterates through an array and returns loop handle each time', async () => {
    const node = { id: 'for-node' };
    const loopStates = new Map();
    const ctx = makeCtx({ node, loopStates });
    const items = ['a', 'b', 'c'];

    // Iteration 1
    const r1 = await handleFor({ iterator: items }, ctx);
    expect(r1.nextHandleId).toBe('loop');
    expect(r1.result.index).toBe(0);
    expect(r1.result.item).toBe('a');

    // Iteration 2
    const r2 = await handleFor({ iterator: items }, ctx);
    expect(r2.nextHandleId).toBe('loop');
    expect(r2.result.index).toBe(1);
    expect(r2.result.item).toBe('b');

    // Iteration 3
    const r3 = await handleFor({ iterator: items }, ctx);
    expect(r3.nextHandleId).toBe('loop');
    expect(r3.result.item).toBe('c');

    // End of array
    const r4 = await handleFor({ iterator: items }, ctx);
    expect(r4.nextHandleId).toBe('exit');
    expect(r4.result.finished).toBe(true);
    expect(r4.result.total).toBe(3);
  });

  it('uses limit to generate a numeric range when no iterator provided', async () => {
    const node = { id: 'for-limit-node' };
    const loopStates = new Map();
    const ctx = makeCtx({ node, loopStates });

    const r1 = await handleFor({ limit: 2 }, ctx);
    expect(r1.nextHandleId).toBe('loop');
    expect(r1.result.index).toBe(0);

    const r2 = await handleFor({ limit: 2 }, ctx);
    expect(r2.nextHandleId).toBe('loop');

    const r3 = await handleFor({ limit: 2 }, ctx);
    expect(r3.nextHandleId).toBe('exit');
  });

  it('exits immediately for empty iterator', async () => {
    const node = { id: 'for-empty' };
    const loopStates = new Map();
    const ctx = makeCtx({ node, loopStates });

    const r = await handleFor({ iterator: [] }, ctx);
    expect(r.nextHandleId).toBe('exit');
    expect(r.result.finished).toBe(true);
    expect(r.result.total).toBe(0);
  });

  it('clears loop state after exit', async () => {
    const node = { id: 'for-clear' };
    const loopStates = new Map();
    const ctx = makeCtx({ node, loopStates });

    await handleFor({ iterator: ['x'] }, ctx); // round 1
    await handleFor({ iterator: ['x'] }, ctx); // exit

    expect(loopStates.has('for-clear')).toBe(false);
  });

  // Regression: running same for-node twice (e.g. outer loop)
  it('re-initializes state after exit when called again', async () => {
    const node = { id: 'for-reinit' };
    const loopStates = new Map();
    const ctx = makeCtx({ node, loopStates });
    const items = ['p', 'q'];

    await handleFor({ iterator: items }, ctx); // loop p
    await handleFor({ iterator: items }, ctx); // loop q
    await handleFor({ iterator: items }, ctx); // exit → clears state

    // Second pass
    const r1 = await handleFor({ iterator: items }, ctx);
    expect(r1.result.index).toBe(0);
    expect(r1.result.item).toBe('p');
  });
});

// ─── handleTrigger ────────────────────────────────────────────────────────────
describe('handleTrigger', () => {
  it('merges resolvedData into triggerData and returns combined result', async () => {
    const triggerData = { existingKey: 'kept' };
    const ctx = makeCtx({ triggerData });
    const resolved = {
      inputs: [{ name: 'newKey', default: 'added', required: false }]
    };

    const { result } = await handleTrigger(resolved, ctx);

    expect(result.existingKey).toBe('kept');
    expect(result.newKey).toBe('added');
    expect(result.triggeredAt).toBeDefined();
  });
});

// ─── handleWaitUpdate ────────────────────────────────────────────────────────
describe('handleWaitUpdate', () => {
  it('returns data when condition resolves to true (signal received)', async () => {
    const latestFormDataRef = { value: { userInput: 'hello' } };
    const condition = vi.fn().mockResolvedValue(true); // signal received
    const ctx = makeCtx({ condition, latestFormDataRef });

    const { result } = await handleWaitUpdate({ timeout: 60 }, ctx);

    expect(condition).toHaveBeenCalledWith(expect.any(Function), 60000);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ userInput: 'hello' });
    expect(latestFormDataRef.value).toBeNull(); // consumed
  });

  it('throws when condition times out (returns false)', async () => {
    const condition = vi.fn().mockResolvedValue(false); // timeout
    const ctx = makeCtx({ condition, latestFormDataRef: { value: null } });

    await expect(handleWaitUpdate({ timeout: 30 }, ctx)).rejects.toThrow(
      'Wait timed out after 30 seconds',
    );
  });

  it('uses default timeout of 3600s', async () => {
    const condition = vi.fn().mockResolvedValue(true);
    const latestFormDataRef = { value: 'data' };
    const ctx = makeCtx({ condition, latestFormDataRef });

    await handleWaitUpdate({}, ctx);

    expect(condition).toHaveBeenCalledWith(expect.any(Function), 3600000);
  });
});
