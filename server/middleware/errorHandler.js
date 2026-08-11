import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', err);

  if (res.headersSent) {
    // If headers already sent, delegate to default Express
    return next(err);
  }

  let statusCode = 500;
  let message = 'Internal Server Error';
  let code = ERROR_CODES.INTERNAL_ERROR;

  if (err instanceof ApiError) {
    message = err.message;
    code = err.code;
    // 默认业务错误映射为 400 (如果不满足 switch，则保证不是 500)
    statusCode = 400; 
    
    switch (code) {
      case ERROR_CODES.UNAUTHORIZED:
        statusCode = 401;
        break;
      case ERROR_CODES.FORBIDDEN:
        statusCode = 403;
        break;
      case ERROR_CODES.NOT_FOUND:
        statusCode = 404;
        break;
      case ERROR_CODES.CONFLICT:
        statusCode = 409;
        break;
      case ERROR_CODES.INTERNAL_ERROR:
        statusCode = 500;
        break;
      // 其他 BAD_REQUEST 类错误保持 400
    }
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for ${err.path}: ${err.value}`;
    code = ERROR_CODES.BAD_REQUEST;
  }

  const payload = {
    success: false,
    error: {
      code,
      message,
    },
  };

  res.status(statusCode).json(payload);
}
