import { buildGeneralSession } from '../../../agent/general/index.js';
import buildGraph from '../../../agent/general/buildGraph.js';
import { AIBaseService } from '../base/AIBaseService.js';
import { EMPLOYEE_SCENARIOS } from '../../../constants/digitalEmployee.js';

/**
 * 通用对话 AI 服务
 */
export class GeneralAIService extends AIBaseService {
  constructor({ userId, appId }) {
    super({ userId, appId, scenario: EMPLOYEE_SCENARIOS.GENERAL });
  }

  /**
   * 执行通用对话 Agent 逻辑
   */
  async *executeAgent({ message, conversationId, refs, docId }) {
    const session = await buildGeneralSession(this.userId, this.appId, conversationId, docId, refs);
    const graph = buildGraph();

    yield* this.streamUniversalGraph(graph, session);
  }
}
