import { agentDockStates } from '../db/schema/index.js';
import { createBaseRepository } from './base.repository.js';

/**
 * Agent Dock State Repository
 */
const adsRepo = createBaseRepository(agentDockStates);

const AgentDockStateRepository = {
  ...adsRepo,

  async findByUserAndTarget(userId, targetId, scenario) {
    return this.findOne({
      where: (t, { eq, and }) =>
        and(eq(t.userId, userId), eq(t.targetId, targetId), eq(t.scenario, scenario)),
    });
  },
};

export default AgentDockStateRepository;
