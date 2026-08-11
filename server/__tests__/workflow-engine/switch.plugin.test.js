import { describe, it, expect } from 'vitest';
import { handler } from '../../registry/plugins/switch/handler.js';

describe('Switch Plugin Handler - Rich Operators & Robust Matching', () => {

  it('matches equals case-insensitively by default', async () => {
    const params = {
      expression: '  FreeTalk  ',
      cases: [
        { value: 'freetalk', handle: 'handle_talk' }
      ]
    };
    const { success, nextHandleId, result } = await handler(params, {});
    expect(success).toBe(true);
    expect(nextHandleId).toBe('handle_talk');
    expect(result.expression).toBe('  FreeTalk  ');
    expect(result.matchedCase).toBe('handle_talk');
  });

  it('respects caseSensitive configuration when set', async () => {
    const params = {
      expression: 'FreeTalk',
      cases: [
        { value: 'freetalk', handle: 'handle_talk', caseSensitive: true },
        { value: 'FreeTalk', handle: 'handle_talk_strict', caseSensitive: true }
      ]
    };
    const { nextHandleId } = await handler(params, {});
    expect(nextHandleId).toBe('handle_talk_strict');
  });

  it('supports contains, starts_with, and ends_with operators', async () => {
    const params = {
      expression: 'prefix_action_suffix',
      cases: [
        { value: 'prefix', handle: 'h1', operator: 'starts_with' },
        { value: 'action', handle: 'h2', operator: 'contains' }
      ]
    };
    // Match h1 because it starts with prefix
    const res = await handler(params, {});
    expect(res.nextHandleId).toBe('h1');
  });

  it('supports regex operators', async () => {
    const params = {
      expression: 'error_code_500',
      cases: [
        { value: 'code_\\d+', handle: 'handle_regex', operator: 'regex' }
      ]
    };
    const { nextHandleId } = await handler(params, {});
    expect(nextHandleId).toBe('handle_regex');
  });

  it('supports numerical comparisons (greater_than, less_than)', async () => {
    const params = {
      expression: 85,
      cases: [
        { value: 90, handle: 'A', operator: '>' },
        { value: 80, handle: 'B', operator: '>' }
      ]
    };
    const { nextHandleId } = await handler(params, {});
    expect(nextHandleId).toBe('B'); // 85 > 80
  });

  it('supports is_empty and is_not_empty', async () => {
    const paramsNull = {
      expression: null,
      cases: [
        { handle: 'h_empty', operator: 'is_empty' }
      ]
    };
    const resNull = await handler(paramsNull, {});
    expect(resNull.nextHandleId).toBe('h_empty');

    const paramsFull = {
      expression: 'hello',
      cases: [
        { handle: 'h_not_empty', operator: 'is_not_empty' }
      ]
    };
    const resFull = await handler(paramsFull, {});
    expect(resFull.nextHandleId).toBe('h_not_empty');
  });

  it('supports custom JS execution', async () => {
    const params = {
      expression: 'unused',
      cases: [
        { value: '10 + 5 === 15', handle: 'custom_success', operator: 'custom' }
      ]
    };
    const { nextHandleId } = await handler(params, {});
    expect(nextHandleId).toBe('custom_success');
  });

  it('falls back to default if no conditions met', async () => {
    const params = {
      expression: 'unknown',
      cases: [
        { value: 'freeTalk', handle: 'h1' }
      ]
    };
    const { nextHandleId } = await handler(params, {});
    expect(nextHandleId).toBe('default');
  });
});
