import { digitalEmployees } from '../db/schema/index.js';
import { createBaseRepository } from './base.repository.js';

/**
 * 数字员工 Repository
 */
const deRepo = createBaseRepository(digitalEmployees);

const DigitalEmployeeRepository = {
  ...deRepo,

  async findByApp(appId, scenario) {
    return this.findAll({
      where: (t, { eq, and, or }) => {
        const conditions = [eq(t.appRef, appId)];
        if (scenario) {
          if (scenario === 'GENERAL') {
            conditions.push(eq(t.scenario, 'GENERAL'));
          } else {
            conditions.push(or(eq(t.scenario, scenario), eq(t.scenario, 'GENERAL')));
          }
        }
        return and(...conditions);
      },
      order: (t, { desc }) => [desc(t.createdAt)]
    });
  }
};

export default DigitalEmployeeRepository;
