import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../../registry/plugins/ensure-convo/handler.js';

// Mock conversationService
vi.mock('../../services/conversationService.js', () => {
  return {
    ensureConversation: vi.fn(),
  };
});

describe('ensureConvo Plugin Handler', () => {
  let mockContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {
      executorId: 'test_user_id',
      appId: 'test_app_id',
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
      triggerData: {
        sessionId: 'trigger_session_id',
        scenario: 'document_assistant',
        targetId: 'doc_123',
        employeeId: 'employee_456',
        message: 'hello trigger',
      },
    };
  });

  it('correctly uses params and falls back to context/triggerData', async () => {
    const { ensureConversation } = await import('../../services/conversationService.js');
    ensureConversation.mockResolvedValue({
      conversation: {
        _id: { toString: () => 'resolved_convo_id' },
        title: 'Mock Convo Title',
        scenario: 'mock_scenario',
        createdAt: '2026-05-21T08:00:00.000Z',
      },
      isNew: true,
    });

    const params = {
      conversationId: 'convo_param',
      scenario: 'scenario_param',
      targetId: 'target_param',
      employeeId: 'employee_param',
      initialMessage: 'initial_message_param',
    };

    const result = await handler(params, mockContext);

    expect(ensureConversation).toHaveBeenCalledWith('convo_param', {
      userId: 'test_user_id',
      appId: 'test_app_id',
      targetId: 'target_param',
      employeeId: 'employee_param',
      scenario: 'scenario_param',
      message: 'initial_message_param',
    });

    expect(result).toEqual({
      success: true,
      result: {
        conversationId: 'resolved_convo_id',
        title: 'Mock Convo Title',
        type: 'mock_scenario',
        scenario: 'mock_scenario',
        createdAt: '2026-05-21T08:00:00.000Z',
        isNew: true,
      }
    });
  });

  it('falls back to triggerData and context values when params are not specified', async () => {
    const { ensureConversation } = await import('../../services/conversationService.js');
    ensureConversation.mockResolvedValue({
      conversation: {
        _id: { toString: () => 'resolved_fallback_id' },
        title: 'Mock Fallback Title',
        scenario: 'document_assistant',
        createdAt: null,
      },
      isNew: false,
    });

    const params = {};

    const result = await handler(params, mockContext);

    expect(ensureConversation).toHaveBeenCalledWith(undefined, {
      userId: 'test_user_id',
      appId: 'test_app_id',
      targetId: 'doc_123',
      employeeId: 'employee_456',
      scenario: 'document_assistant',
      message: 'hello trigger',
    });

    expect(result).toEqual({
      success: true,
      result: {
        conversationId: 'resolved_fallback_id',
        title: 'Mock Fallback Title',
        type: 'document_assistant',
        scenario: 'document_assistant',
        createdAt: null,
        isNew: false,
      }
    });
  });

  it('cleans unresolved variables and uses nested trigger metadata/data fallbacks', async () => {
    const { ensureConversation } = await import('../../services/conversationService.js');
    ensureConversation.mockResolvedValue({
      conversation: {
        _id: { toString: () => 'resolved_clean_id' },
        title: 'Mock Fallback Title',
        scenario: 'scene',
        createdAt: null,
      },
      isNew: false,
    });

    const params = {
      conversationId: '{{trigger.sessionId}}',
      scenario: 'undefined',
      targetId: 'null',
      employeeId: '{{trigger.employeeId}}',
      initialMessage: '  ',
    };

    const nestedMockContext = {
      executorId: 'test_user_id',
      appId: 'test_app_id',
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      },
      triggerData: {
        sessionId: 'trigger_session_id',
        message: 'hello trigger',
        scenario: 'scene',
        targetId: 'targetid',
        employeeId: 'employId',
      },
    };

    const result = await handler(params, nestedMockContext);

    expect(ensureConversation).toHaveBeenCalledWith(undefined, {
      userId: 'test_user_id',
      appId: 'test_app_id',
      targetId: 'targetid',
      employeeId: 'employId',
      scenario: 'scene',
      message: 'hello trigger',
    });

    expect(result).toEqual({
      success: true,
      result: {
        conversationId: 'resolved_clean_id',
        title: 'Mock Fallback Title',
        type: 'scene',
        scenario: 'scene',
        createdAt: null,
        isNew: false,
      }
    });
  });
});

