import fs from 'fs';
import path from 'path';
import { logger } from '../../config/logger.js';
import env from '../../config/env.js';

// Move TRACE_DIR outside the server folder to prevent nodemon restarts during AI node execution
const TRACE_DIR = path.join(process.cwd(), '..', 'logs', 'traces');

const colors = {
  PARENT: '\x1b[36m', // Cyan
  EXPERT: '\x1b[35m', // Magenta
  TOOL: '\x1b[33m', // Yellow
  LLM: '\x1b[32m', // Green (New)
  SYSTEM: '\x1b[90m', // Gray
  RESET: '\x1b[0m',
  DIM: '\x1b[2m',
  BOLD: '\x1b[1m',
};

/**
 * TraceLogger: Specialized logger for sequential human-readable execution trails.
 * Maps 1:1 to a specific execution (Node or Workflow).
 */
class TraceLogger {
  constructor() {
    this.shouldWriteFile = true;
    if (this.shouldWriteFile && !fs.existsSync(TRACE_DIR)) {
      try {
        fs.mkdirSync(TRACE_DIR, { recursive: true });
      } catch (err) {
        // Fallback for restricted environments
      }
    }
  }

  /**
   * Append a line to the trace file and/or print to console.
   * @param {string} id - The executionId/correlationId
   * @param {string} role - PARENT, EXPERT, SYSTEM, TOOL
   * @param {string} message - The content to log
   */
  append(id, role, message) {
    if (!id || id === 'undefined') return;

    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:mm:ss
    const cleanRole = (role || 'SYSTEM').toUpperCase();

    // 1. Console Output (Colored & Formatted)
    const color = colors[cleanRole] || colors.SYSTEM;
    const shortId = id.substring(0, 8);
    const consoleLine = `${colors.DIM}[${timestamp}]${colors.RESET} ${colors.BOLD}${color}[${cleanRole.padEnd(7)}]${colors.RESET} ${colors.DIM}(${shortId})${colors.RESET} ${message}`;

    console.log(consoleLine);

    // 2. File Output (Optional)
    if (this.shouldWriteFile) {
      const filePath = path.join(TRACE_DIR, `${id}.log`);
      const fileLine = `[${timestamp}] [${cleanRole.padEnd(7)}] ${message}\n`;

      try {
        fs.appendFileSync(filePath, fileLine, 'utf-8');
      } catch (err) {
        logger.warn({ id, err }, '[TraceLogger] Failed to write trace file');
      }
    }
  }

  /**
   * Special helper for AI thought process
   */
  thought(id, role, content) {
    if (!content) return;
    // this.append(id, role, `${colors.DIM}Thinking...${colors.RESET}\n${content.trim()}`);
  }

  /**
   * Special helper for Tool calls
   */
  tool(id, role, name, args) {
    this.append(
      id,
      role,
      `调用工具: ${colors.BOLD}${name}${colors.RESET} (参数: ${JSON.stringify(args)})`,
    );
  }

  /**
   * Special helper for Tool results
   */
  result(id, role, name, output) {
    const truncated = typeof output === 'string' ? output : JSON.stringify(output);
    const displayResult = truncated.length > 800 ? truncated.substring(0, 800) + '...' : truncated;
    this.append(id, role, `工具结果 [${name}]: ${displayResult}`);
  }
}

export default new TraceLogger();
