// 中文注释: 统一业务错误类，所有可预期错误都应抛出该类型，errorHandler 将统一包装成 200 响应。
// 已接入 constants/errorCodes.js，避免硬编码，便于后续国际化与前端细分处理。
import { ERROR_CODES } from '../constants/errorCodes.js';

class ApiError extends Error {
  constructor(code, message, meta = {}) {
    super(message);
    this.code = code; // 业务错误码，例如 AI_INTENT_PARSE_FAIL
    this.meta = meta; // 附加调试字段（仅内部使用，不直接透出给前端）
  }

  static badRequest(message = '请求参数错误', meta) {
    return new ApiError(ERROR_CODES.BAD_REQUEST, message, meta);
  }
  static unauthorized(message = '未授权', meta) {
    return new ApiError(ERROR_CODES.UNAUTHORIZED, message, meta);
  }
  static forbidden(message = '无权限', meta) {
    return new ApiError(ERROR_CODES.FORBIDDEN, message, meta);
  }
  static notFound(message = '资源不存在', meta) {
    return new ApiError(ERROR_CODES.NOT_FOUND, message, meta);
  }
  static conflict(message = '资源冲突', meta) {
    return new ApiError(ERROR_CODES.CONFLICT, message, meta);
  }
  static intentParseFail(message = '意图解析失败', meta) {
    return new ApiError(ERROR_CODES.AI_INTENT_PARSE_FAIL, message, meta);
  }
  static modelInvokeFail(message = '模型调用失败', meta) {
    return new ApiError(ERROR_CODES.AI_MODEL_INVOKE_FAIL, message, meta);
  }
  static chartRecommendFail(message = '图表推荐失败', meta) {
    return new ApiError(ERROR_CODES.AI_CHART_RECOMMEND_FAIL, message, meta);
  }
  static internal(message = '服务器内部错误', meta) {
    return new ApiError(ERROR_CODES.INTERNAL_ERROR, message, meta);
  }
}
export default ApiError;
export { ApiError };
