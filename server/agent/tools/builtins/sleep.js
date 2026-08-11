import { z } from 'zod';

export const sleepTool = {
  name: 'sleep',
  description: '延迟/休眠指定的秒数。适用于需要等待某个异步任务完成，或在轮询重试之间引入间隔。',
  isGlobal: true, // 默认注入到所有 Agent 中作为全局工具
  inputSchema: z.object({
    seconds: z.number().int().min(1).max(300).describe('需要等待/休眠的秒数，范围为 1-300 秒'),
  }),
  execute: async (args, context) => {
    const seconds = args.seconds || 5;
    // 标记为 client_tool，指示工作流引擎在 Workflow 协程内非阻塞休眠，而非在 Activity 线程中阻塞
    return {
      __isClientTool__: true,
      clientToolName: 'sleep',
      args: { seconds },
    };
  },
};
