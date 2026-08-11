import { agentTeams } from '../db/schema/index.js';
import { createBaseRepository } from './base.repository.js';
import { mapResponse } from '../db/utils.js';

const baseRepo = createBaseRepository(agentTeams);

const AgentTeamRepository = {
  ...baseRepo,

  // 查询当前低代码应用下关联的所有协同项目组
  async findByApp(appId) {
    const list = await this.findAll({
      where: (t, { eq }) => eq(t.appRef, appId),
      order: (t, { desc }) => [desc(t.createdAt)]
    });
    return list.map(mapResponse);
  },

  // 查询单个项目组详情
  async findTeamDetail(id) {
    const team = await this.findById(id);
    return team ? mapResponse(team) : null;
  }
};

export default AgentTeamRepository;
