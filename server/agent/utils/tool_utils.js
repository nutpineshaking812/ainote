import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * 将工具定义转换为 OpenAI Function Schema。
 * 在 Zod 版本冲突（如 zod 4.x）导致标准库失效时，提供手动降级恢复路径。
 */
export function openAITools(tools) {
  const seenNames = new Set();
  const uniqueTools = [];

  // 1. 去重保护，防止内置工具与数据库技能重名
  for (const tool of tools) {
    if (!tool || !tool.name) continue;
    if (seenNames.has(tool.name)) continue;
    seenNames.add(tool.name);
    uniqueTools.push(tool);
  }

  return uniqueTools.map((toolConfig) => {
    let parametersJsonSchema = {};
    const inputSchema = toolConfig.inputSchema;
    
    const isZod = inputSchema && (
      typeof inputSchema.safeParse === 'function' || 
      (inputSchema._def && inputSchema.parse)
    );

    if (isZod) {
      try {
        // 尝试标准转换
        parametersJsonSchema = zodToJsonSchema(inputSchema);
        
        // 兜底：如果转换结果为空对象，尝试手动从 _def 提取 (应对 Zod 版本版本冲突)
        if (Object.keys(parametersJsonSchema.properties || {}).length === 0 && inputSchema._def?.shape) {
          const shape = typeof inputSchema._def.shape === 'function' ? inputSchema._def.shape() : inputSchema._def.shape;
          const recoveredProps = {};
          const required = [];
          
          if (shape) {
            Object.entries(shape).forEach(([key, value]) => {
              recoveredProps[key] = { 
                type: 'string', // 默认回退为 string 类型
                description: value.description || value._def?.description || '' 
              };
              // 简单判断必填项
              if (!value.isOptional || !value._def?.defaultValue) required.push(key);
            });
            parametersJsonSchema = {
              type: 'object',
              properties: recoveredProps,
              required: required.length > 0 ? required : undefined
            };
          }
        }
      } catch (err) {
        parametersJsonSchema = { type: 'object', properties: {} };
      }
    } else {
      parametersJsonSchema = inputSchema || { type: 'object', properties: {} };
    }

    // 清理非标准字段并确保结构完整
    if (parametersJsonSchema.$schema) delete parametersJsonSchema.$schema;
    if (!parametersJsonSchema.type) parametersJsonSchema.type = 'object';
    if (!parametersJsonSchema.properties) parametersJsonSchema.properties = {};

    return {
      type: 'function',
      function: {
        name: toolConfig.name,
        description: toolConfig.description || toolConfig.name,
        parameters: parametersJsonSchema,
      },
    };
  });
}
