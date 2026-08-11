import { createAnalysisSession } from '../../../agent/dataAnalysis/index.js';
import buildAnalysisGraph from '../../../agent/dataAnalysis/buildAnalysisGraph.js';
import { AIBaseService } from '../base/AIBaseService.js';
import { HumanMessage } from '@langchain/core/messages';
import { EMPLOYEE_SCENARIOS } from '../../../constants/digitalEmployee.js';

/**
 * 数据分析 AI 服务
 */
export class AnalysisAIService extends AIBaseService {
  constructor({ userId, appId, conversationId }) {
    super({ userId, appId, scenario: EMPLOYEE_SCENARIOS.VIEW_DESIGN });
    this.conversationId = conversationId;
  }

  /**
   * 执行数据分析 Agent 逻辑
   */
  async *executeAgent({ message }) {
    const session = await createAnalysisSession(this.userId, this.appId, this.conversationId);
    session.messages.push(new HumanMessage({ content: message }));

    const graph = buildAnalysisGraph();

    // 构建初始状态，确保字段对齐
    const inputState = {
      ...session,
      pipeline: {},
      taskState: {},
      schema: {},
      data: {},
      forms: {},
    };

    yield* this.streamUniversalGraph(graph, inputState);
  }
}
