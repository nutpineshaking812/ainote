/**
 * Built-in tool: Get current system time.
 * Provides the model with the current date, time, and timezone context.
 */

export const getCurrentTimeTool = {
  name: 'get_current_time',
  description: '获取当前的系统时间、日期和星期。当你需要知道现在的时间来回答问题时使用此工具。',
  isGlobal: true, // Mark this as a global tool, dynamically injected to all agent runs
  inputSchema: {
    type: 'object',
    properties: {}, // No inputs required
  },
  execute: async (args, context) => {
    const now = new Date();
    
    // Provide a comprehensive time context for the LLM
    const timeContext = {
      isoStamp: now.toISOString(),
      localDateTime: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      date: now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      time: now.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      weekday: now.toLocaleDateString('zh-CN', { weekday: 'long', timeZone: 'Asia/Shanghai' }),
      timeZone: 'Asia/Shanghai (UTC+8)',
    };
    
    return timeContext;
  },
};
