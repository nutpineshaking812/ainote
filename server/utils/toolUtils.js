// 创建
function createTool(name, description, properties, required, formatResult) {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        properties: properties,
        required: required
      },
      formatResult
    }
  }
}

// 参数校验
function checkToolsParams(toolSpec, parameters) {
  if (toolSpec.function.parameters.required?.length > 0) {
    const missingParams = toolSpec.function.parameters.required.filter(
      param => !(param in parameters)
    );
    if (missingParams.length > 0) {
      throw new Error(`缺少必填参数: ${missingParams.join(', ')}`);
    }
  }
}

export {
  createTool,
  checkToolsParams
};