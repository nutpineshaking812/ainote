import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { chatConversations } from '../../db/schema/chatConversations.js';
import ChatConversationRepository from '../../repositories/chatConversation.repository.js';

// Mock DB
vi.mock('../../db/index.js', () => {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation((val) => {
      return Promise.resolve([
        {
          id: 'convo_1',
          userId: 'user_123',
          appId: 'app_456',
          targetId: 'doc_abc',
          employeeId: 'employee_xyz',
          scenario: 'DOCUMENT',
          title: 'My Convo',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]);
    }),
  };
  return {
    db: mockQuery,
  };
});

describe('ChatConversationRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query conversations with filter parameters successfully', async () => {
    const userId = 'user_123';
    const appId = 'app_456';
    const opts = {
      limit: 10,
      type: 'DOCUMENT',
      targetId: 'doc_abc',
      employeeId: 'employee_xyz',
      scenario: 'DOCUMENT',
    };

    const results = await ChatConversationRepository.findByUserAndApp(userId, appId, opts);

    expect(results).toHaveLength(1);
    expect(results[0]._id).toBe('convo_1');
    expect(results[0].targetId).toBe('doc_abc');

    expect(db.select).toHaveBeenCalled();
    expect(db.from).toHaveBeenCalledWith(chatConversations);
    expect(db.where).toHaveBeenCalled();
    expect(db.orderBy).toHaveBeenCalled();
    expect(db.limit).toHaveBeenCalledWith(10);

    // Verify conditions are built and passed to the 'and' helper
    const whereCall = vi.mocked(db.where).mock.calls[0][0];
    expect(whereCall).toBeDefined();
  });

  it('should respect backward compatibility when opts is a number limit', async () => {
    const userId = 'user_123';
    const appId = 'app_456';
    const limit = 25;

    await ChatConversationRepository.findByUserAndApp(userId, appId, limit);

    expect(db.limit).toHaveBeenCalledWith(25);
  });
});
