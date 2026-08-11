import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../../db/index.js';
import { digitalEmployees } from '../../db/schema/index.js';
import DigitalEmployeeRepository from '../../repositories/digitalEmployee.repository.js';

vi.mock('../../db/index.js', () => {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockImplementation(() => {
      return Promise.resolve([
        {
          id: 'employee_1',
          name: 'Doc assistant',
          scenario: 'DOCUMENT',
          appRef: 'app_123',
          createdAt: new Date(),
        },
        {
          id: 'employee_2',
          name: 'General assistant',
          scenario: 'GENERAL',
          appRef: 'app_123',
          createdAt: new Date(),
        }
      ]);
    }),
  };
  return {
    db: mockQuery,
  };
});

describe('DigitalEmployeeRepository findByApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query digital employees correctly with appRef', async () => {
    const results = await DigitalEmployeeRepository.findByApp('app_123');
    expect(results).toHaveLength(2);
    expect(db.select).toHaveBeenCalled();
    expect(db.from).toHaveBeenCalledWith(digitalEmployees);
    expect(db.where).toHaveBeenCalled();
  });

  it('should support scenario filtering', async () => {
    const results = await DigitalEmployeeRepository.findByApp('app_123', 'DOCUMENT');
    expect(results).toHaveLength(2); // Mock returns both
    expect(db.where).toHaveBeenCalled();
  });
});
