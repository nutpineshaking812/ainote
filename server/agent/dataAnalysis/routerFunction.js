// 数据分析Agent路由函数
import { dispatchEvent } from '../../utils/langgraphUtils.js';
import { eventType } from './index.js';
import { baseRouterFunction } from '../core/nodes/routerFunction.js';

const routerFunction = (state) => {
  const next = baseRouterFunction(state);
  if (next === 'tool_executor') return next;

  const lastMessage = state.messages[state.messages.length - 1];

  // 判断 pipeline 查询
  // console.log('路由检查: taskState.status=', state.taskState, 'pipeline=', state.pipeline);
  dispatchEvent(eventType.DEBUG, {
    taskState: state.taskState,
    status: state.taskState.task?.status,
    final_components: state.taskState.final_components,
  });
  if (state.taskState.task.status === 'complete') {
    console.log('路由: 进入 pipeline_query 节点');
    // sendToolPlanEvent({ content: '路由: 进入 pipeline_query 节点' });
    return 'build_query';
  }

  // 检查是否生成了查询（在content中包含JSON格式的聚合管道）
  if (lastMessage.content) {
    try {
      const contentObj = JSON.parse(lastMessage.content);
      if (Array.isArray(contentObj) && contentObj.length > 0 && contentObj[0].$match) {
        // sendToolPlanEvent({ content: '路由: 生成查询完成' });
        return '__end__';
      }
    } catch (e) {
      // 不是JSON格式，继续检查其他条件
      // console.log('路由: 不是JSON格式，继续检查其他条件');
    }
  }

  // 如果是普通回复，则等待用户输入
  if (lastMessage.content && (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0)) {
    // sendToolPlanEvent({ content: '路由: 等待用户输入' });
    return 'interrupt';
  }

  return '__end__';
};

export default routerFunction;
