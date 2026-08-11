import { StateGraph, START, END } from '@langchain/langgraph';
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch';
import { BaseAgentState } from '../core/BaseState.js';
import { createToolExecutorNode } from '../core/nodes/toolExecutorNode.js';
import agentNode, { availableTools } from './agentNode.js';

const toolExecutorNode = createToolExecutorNode(availableTools);
import { buildQueryNode } from './buildQueryNode.js';
import routerFunction from './routerFunction.js';

async function endNode(state, config) {
  // 终止节点，直接返回当前状态
  // yield { type: 'final_state', data: state };
  // sendEvent({ type: 'final_state', data: state });
  // config.writer?.("分析流程结束。");
  await dispatchCustomEvent('endNode', state);
  return { ...state };
}

function buildAnalysisGraph() {
  const workflow = new StateGraph({
    channels: {
      ...BaseAgentState,
      pipeline: { value: (x, y) => y ?? x, default: () => null },
      taskState: {
        value: (x, y) => ({ ...x, ...y }),
        default: () => ({
          task: { value: (x, y) => y ?? x, default: () => null },
          schema: { value: (x, y) => y ?? x, default: () => null },
          data: { value: (x, y) => y ?? x, default: () => null },
          forms: { value: (x, y) => y ?? x, default: () => null },
        }),
      },
    },
  });

  // 添加节点
  workflow.addNode('agent', agentNode);
  workflow.addNode('tool_executor', toolExecutorNode);
  workflow.addNode('build_query', buildQueryNode);
  workflow.addNode('end', endNode);

  // 设置边
  workflow.addEdge(START, 'agent');
  workflow.addConditionalEdges('agent', routerFunction, {
    tool_executor: 'tool_executor',
    build_query: 'build_query',
    interrupt: 'end',
    __end__: 'end',
  });
  workflow.addEdge('tool_executor', 'agent');
  workflow.addEdge('build_query', 'end');
  workflow.addEdge('end', END);

  return workflow.compile();
}

export default buildAnalysisGraph;
