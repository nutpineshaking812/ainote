/**
 * Tests: workflow-engine/resolver.js
 *
 * resolveVariables — pure function, no mocks needed.
 * evaluateCondition — pure function, uses Function() for expression eval.
 */
import { describe, it, expect } from 'vitest';
import { resolveVariables, evaluateCondition } from '../../temporal/workflow-engine/resolver.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a nodeResults Map from a plain object, wrapped as { result, resolvedConfig } */
function makeNodeResults(obj) {
  return new Map(Object.entries(obj).map(([k, v]) => [k, { result: v, resolvedConfig: {} }]));
}

// ─── resolveVariables ─────────────────────────────────────────────────────────
describe('resolveVariables', () => {
  it('returns data unchanged when no templates present', () => {
    const data = { label: 'Hello', count: 42 };
    const result = resolveVariables(data, new Map(), {});
    expect(result.label).toBe('Hello');
    expect(result.count).toBe(42);
  });

  it('resolves a simple {{trigger.field}} reference', () => {
    const data = { greeting: 'Hello {{trigger.name}}' };
    const result = resolveVariables(data, new Map(), { name: 'World' });
    expect(result.greeting).toBe('Hello World');
  });

  it('resolves node output reference {{nodeId.field}}', () => {
    const nodeResults = makeNodeResults({ node1: { answer: 42 } });
    const data = { value: '{{node1.answer}}' };
    const result = resolveVariables(data, nodeResults, {});
    expect(result.value).toBe(42);
  });

  it('returns the raw object when single-var resolves to an object', () => {
    const nodeResults = makeNodeResults({ node1: { items: [1, 2, 3] } });
    const data = { list: '{{node1.items}}' };
    const result = resolveVariables(data, nodeResults, {});
    expect(result.list).toEqual([1, 2, 3]);
  });

  it('resolves {{previousNode.field}} alias', () => {
    const nodeResults = makeNodeResults({ node1: { text: 'prev output' } });
    const data = { echo: '{{previousNode.text}}' };
    const result = resolveVariables(data, nodeResults, {}, 'node1', 'node2');
    expect(result.echo).toBe('prev output');
  });

  it('resolves nested objects recursively', () => {
    const data = {
      outer: {
        inner: '{{trigger.x}}',
      },
    };
    const result = resolveVariables(data, new Map(), { x: 'deep' });
    expect(result.outer.inner).toBe('deep');
  });

  it('resolves arrays recursively', () => {
    const data = { items: ['{{trigger.a}}', '{{trigger.b}}'] };
    const result = resolveVariables(data, new Map(), { a: 'first', b: 'second' });
    expect(result.items).toEqual(['first', 'second']);
  });

  it('keeps unresolved template as-is in string interpolation', () => {
    const data = { msg: 'prefix {{missing.field}} suffix' };
    const result = resolveVariables(data, new Map(), {});
    expect(result.msg).toBe('prefix {{missing.field}} suffix');
  });

  it('resolves undefined to undefined for single-var template', () => {
    const data = { val: '{{missing.field}}' };
    const result = resolveVariables(data, new Map(), {});
    expect(result.val).toBeUndefined();
  });

  it('applies |json filter to stringify objects in string context', () => {
    const nodeResults = makeNodeResults({ n1: { obj: { a: 1 } } });
    const data = { serialized: 'data: {{n1.obj|json}}' };
    const result = resolveVariables(data, nodeResults, {});
    expect(result.serialized).toBe('data: {"a":1}');
  });

  it('applies nested property path extraction after json filter', () => {
    const nodeResults = makeNodeResults({ 
      n1: '{"intent":"freeTalk","query":{"content":"hi"}}' 
    });
    const data = { 
      intent: '{{n1|json.intent}}',
      content: '{{n1|json.query.content}}'
    };
    const result = resolveVariables(data, nodeResults, {});
    expect(result.intent).toBe('freeTalk');
    expect(result.content).toBe('hi');
  });

  it('applies |date:YYYY-MM-DD filter', () => {
    const nodeResults = makeNodeResults({ n1: { ts: '2024-06-15T10:30:00.000Z' } });
    const data = { formatted: '{{n1.ts|date:YYYY-MM-DD}}' };
    const result = resolveVariables(data, nodeResults, {});
    expect(result.formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('provides system date variables: {{today}}, {{now}}, {{date.year}}', () => {
    const data = { t: '{{today}}', n: '{{now}}', y: '{{date.year}}' };
    const result = resolveVariables(data, new Map(), {});
    expect(result.t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.n).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.y).toMatch(/^\d{4}$/);
  });

  it('skips .output segment transparently', () => {
    const nodeResults = makeNodeResults({ n1: { content: 'hello' } });
    const data = { val: '{{n1.output.content}}' };
    const result = resolveVariables(data, nodeResults, {});
    expect(result.val).toBe('hello');
  });

  it('applies chained filters sequentially: json.path then str', () => {
    const nodeResults = makeNodeResults({
      pla_NWD6: '{"output":{"queryResult":[{"name":"张三","score":95}]}}'
    });
    const data = { val: '{{pla_NWD6|json.output.queryResult|str}}' };
    const result = resolveVariables(data, nodeResults, {});
    expect(result.val).toBe('[{"name":"张三","score":95}]');
  });

  it('returns null/undefined as-is for null data', () => {
    expect(resolveVariables(null, new Map(), {})).toBeNull();
    expect(resolveVariables(undefined, new Map(), {})).toBeUndefined();
  });
});

// ─── evaluateCondition ────────────────────────────────────────────────────────
describe('evaluateCondition', () => {
  it('returns false for empty expression', () => {
    expect(evaluateCondition('', new Map(), {})).toBe(false);
    expect(evaluateCondition(null, new Map(), {})).toBe(false);
  });

  it('evaluates a simple literal true expression', () => {
    expect(evaluateCondition('1 === 1', new Map(), {})).toBe(true);
    expect(evaluateCondition('1 === 2', new Map(), {})).toBe(false);
  });

  it('resolves trigger variables in condition', () => {
    const result = evaluateCondition('{{trigger.count}} > 5', new Map(), { count: 10 });
    expect(result).toBe(true);
  });

  it('resolves node output variables in condition', () => {
    const nodeResults = makeNodeResults({ n1: { status: 'success' } });
    const result = evaluateCondition("{{n1.status}} === 'success'", nodeResults, {});
    expect(result).toBe(true);
  });

  it('returns false on JS syntax error (no crash)', () => {
    // Malformed expression should not throw
    expect(() => evaluateCondition('invalid !!!! JS', new Map(), {})).not.toThrow();
    expect(evaluateCondition('invalid !!!! JS', new Map(), {})).toBe(false);
  });
});
