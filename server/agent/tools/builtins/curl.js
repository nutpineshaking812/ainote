import { z } from 'zod';
import axios from 'axios';
import { logger } from '../../../config/logger.js';

/**
 * Safely parse a value that may be a JSON string or already an object/string.
 * Returns the parsed value, or the original value on failure.
 */
const safeParseJson = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const curlTool = {
  isGlobal: true,
  name: 'curl',
  description:
    'Makes a generic HTTP request (GET, POST, etc.) to any public API or website. ' +
    'Use this for integrations not covered by specific tools. ' +
    'IMPORTANT: "headers" must be a plain key-value object (not a JSON string). ' +
    '"body" must be a plain object for JSON payloads (not a JSON string). ' +
    'Include cookies in the "cookie" header key if needed.',
  inputSchema: z.object({
    url: z.string().describe('The full destination URL including query parameters if any'),
    method: z
      .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
      .default('GET')
      .describe('The HTTP method to use'),
    headers: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        'HTTP headers as a plain key-value object. Include "cookie" here if the request requires session cookies.',
      ),
    body: z
      .any()
      .optional()
      .describe(
        'Request body for POST/PUT/PATCH. Pass a plain object — do NOT pre-serialize to JSON string.',
      ),
  }),
  execute: async ({ url, method, headers, body }) => {
    // Defensively handle LLM passing headers/body as JSON strings
    const resolvedHeaders = safeParseJson(headers) || {};
    const resolvedBody = safeParseJson(body);

    logger.debug({ url, method, headers: resolvedHeaders }, '[curlTool] Executing request');

    try {
      const response = await axios({
        url,
        method,
        headers: {
          'Content-Type': 'application/json',
          // Allow caller to override User-Agent (e.g. browser UA for scraping)
          'User-Agent': 'Mozilla/5.0 (Node.js AI Agent)',
          ...resolvedHeaders,
        },
        data: resolvedBody,
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024,
        // Don't throw on non-2xx to let us handle the error gracefully
        validateStatus: () => true,
      });

      const responseData = response.data;
      const responseStr =
        typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
      const maxLength = 25000;

      const payload = {
        status: response.status,
        statusText: response.statusText,
        // Only forward essential response headers to avoid polluting context
        contentType: response.headers?.['content-type'],
        data: responseStr.length > maxLength
          ? responseStr.substring(0, maxLength) + '\n\n... (truncated)'
          : responseData,
        ...(responseStr.length > maxLength && { isTruncated: true }),
      };

      if (response.status >= 400) {
        logger.warn({ url, status: response.status }, '[curlTool] Non-2xx response');
        return { error: `HTTP ${response.status}: ${response.statusText}`, ...payload };
      }

      return payload;
    } catch (error) {
      logger.error({ url, err: error.message }, '[curlTool] Request failed');
      return { error: error.message };
    }
  },
};
