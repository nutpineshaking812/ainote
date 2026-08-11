// Unified success response helper
// Usage: sendSuccess(res, data, statusCode?)
// Ensures a consistent envelope: { success: true, data }
export function sendSuccess(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}
