import { StateGraph, START, END } from '@langchain/langgraph';
import { BaseAgentState } from '../core/BaseState.js';
import { createToolExecutorNode } from '../core/nodes/toolExecutorNode.js';
import { baseRouterFunction } from '../core/nodes/routerFunction.js';
import { agentNode, availableTools } from './agentNode.js';

const toolExecutorNode = createToolExecutorNode(availableTools);
const routerFunction = baseRouterFunction;

function buildGeneralGraph() {
  const workflow = new StateGraph({
    channels: {
      ...BaseAgentState,
      refs: { value: (x, y) => y ?? x, default: () => [] },
      docId: { value: (x, y) => y ?? x, default: () => null },
    },
  });

  // 添加节点
  workflow.addNode('agent', agentNode);
  workflow.addNode('tool_executor', toolExecutorNode);
  // 设置边
  workflow.addEdge(START, 'agent');
  workflow.addConditionalEdges('agent', routerFunction, {
    tool_executor: 'tool_executor',
    __end__: END,
  });
  workflow.addEdge('tool_executor', 'agent');
  return workflow.compile();
}

export default buildGeneralGraph;
