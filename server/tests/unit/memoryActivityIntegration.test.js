import { describe, it, expect, vi } from 'vitest';
import { upsertMemorySection, getMemoryHeaders } from '../../temporal/activities/memory.activity.js';
import AIMemoryRepository from '../../repositories/aiMemory.repository.js';
import MemoryService from '../../services/memory/MemoryService.js';
import { db } from '../../db/index.js';

// Mock DB, Repository and MemoryService
vi.mock('../../repositories/aiMemory.repository.js', () => ({
  default: {
    create: vi.fn(),
  },
}));

vi.mock('../../services/memory/MemoryService.js', () => ({
  default: {
    indexMemoryCard: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../db/index.js', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  return { db: mockDb };
});

describe('Memory Activity - Drizzle Integration', () => {
  it('应该能正常处理“会话-分类”层级下的知识点更新', async () => {
    const existingMarkdown = `## 会话A - FACT > 背景
这是旧的背景内容。

## 会话A - FACT > 现状
目前的业务情况。`;

    const memoryCard = {
      id: 'card123',
      content: existingMarkdown,
      title: '会话A - FACT',
      sessionId: 'sess1',
      appId: 'app1',
      category: 'FACT',
    };

    // Mock db.select().from().where() to return existing memory card
    const updatedMemoryCard = {
      ...memoryCard,
      content: `## 会话A - FACT > 背景\n这是更新后的新背景内容。\n\n## 会话A - FACT > 现状\n目前的业务情况。`,
    };

    vi.mocked(db.select).mockReturnThis();
    vi.mocked(db.from).mockReturnThis();
    vi.mocked(db.where).mockImplementation(() => {
      const promise = Promise.resolve([memoryCard]);
      promise.returning = vi.fn().mockResolvedValue([updatedMemoryCard]);
      return promise;
    });

    // Mock db.update().set().where()
    vi.mocked(db.update).mockReturnThis();
    vi.mocked(db.set).mockReturnThis();

    const activityInput = {
      appId: 'app1',
      sessionName: '会话A',
      sessionId: 'sess1',
      category: 'FACT',
      sectionHeader: '背景',
      content: '这是更新后的新背景内容。',
    };

    const result = await upsertMemorySection(activityInput);

    expect(result.success).toBe(true);
    expect(result.memoryId).toBe('card123');
    expect(MemoryService.indexMemoryCard).toHaveBeenCalled();
  });

  it('getMemoryHeaders 应该返回带路径的扁平化列表给 AI', async () => {
    const memoryCard = {
      id: 'card123',
      content: `## 核心概览\n内容\n## 详细步骤 > 步骤1\n内容`,
      title: '操作手册 - FACT',
      category: 'FACT',
      appId: 'app1',
      sessionId: 'sess1',
    };

    // Mock db.select().from().where()
    vi.mocked(db.select).mockReturnThis();
    vi.mocked(db.from).mockReturnThis();
    vi.mocked(db.where).mockResolvedValue([memoryCard]);

    const result = await getMemoryHeaders({
      appId: 'app1',
      sessionId: 'sess1',
      categories: ['FACT'],
    });

    expect(result.categories.FACT).toContain('核心概览');
    expect(result.categories.FACT).toContain('详细步骤 > 步骤1');
  });
});
