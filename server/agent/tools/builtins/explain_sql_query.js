import { z } from 'zod';
import { db } from '../../../db/index.js';
import { sql as drizzleSql } from 'drizzle-orm';
import ApiError from '../../../utils/ApiError.js';

/**
 * SQL 性能分析工具 (EXPLAIN ANALYZE)
 */
export const explainSqlQuery = {
  name: 'explain_sql_query',
  description:
    '对指定的 SQL 查询进行性能分析（EXPLAIN ANALYZE）。当你想验证查询是否高效、是否命中索引时使用。',
  inputSchema: z.object({
    sql: z.string().describe('要分析的 SQL SELECT 语句'),
  }),
  execute: async ({ sql }, context) => {
    if (!sql) throw ApiError.badRequest('缺少 SQL 语句');

    // 基础安全性检查：仅允许 SELECT
    const trimmedSql = sql.trim().toUpperCase();
    if (!trimmedSql.startsWith('SELECT')) {
      throw ApiError.badRequest('仅允许分析 SELECT 查询语句');
    }

    // 严格限制：只能分析白名单中的表 (复用 execute_sql_query 的逻辑)
    const TABLE_WHITELIST = ['form_records', 'lc.form_records'];
    // 清理 SQL 中标准函数里的 FROM 关键字 (如 EXTRACT/SUBSTRING/TRIM/OVERLAY) 以免误判为表名
    const cleanedSql = cleanSqlOfFunctionFrom(sql);
    // 匹配 FROM 或 JOIN 后的表名，支持转义双引号、反斜杠、单引号等极其复杂的转义格式
    const tableMatchRegex = /(?:FROM|JOIN)\s+([a-zA-Z0-9_."'\`\\]+)/gi;
    let match;
    let tablesFound = [];
    while ((match = tableMatchRegex.exec(cleanedSql)) !== null) {
      // 如果匹配到的表名后紧跟开括号 '('，则说明它实际上是个函数调用 (例如 FROM TO_TIMESTAMP(...))
      const afterMatch = cleanedSql.substring(match.index + match[0].length).trimStart();
      if (afterMatch.startsWith('(')) {
        continue;
      }
      const cleanTable = match[1].replace(/["'\\`]/g, '').toLowerCase();
      tablesFound.push(cleanTable);
    }

    if (tablesFound.length === 0) {
      throw ApiError.badRequest('未能识别 SQL 中的目标表，请确保包含 FROM 子句');
    }

    const unauthorizedTables = tablesFound.filter((t) => !TABLE_WHITELIST.includes(t));
    if (unauthorizedTables.length > 0) {
      throw ApiError.badRequest(
        `仅允许分析针对以下表的查询: ${TABLE_WHITELIST.join(', ')}。当前尝试访问: ${unauthorizedTables.join(', ')}`,
      );
    }

    try {
      // 构造 EXPLAIN ANALYZE 语句
      // 使用 FORMAT JSON 以便 AI 更好地解析 (也可以用文本，取决于习惯)
      const explainSql = `EXPLAIN (ANALYZE, COSTS, VERBOSE, BUFFERS, FORMAT JSON) ${sql}`;
      console.log(`[explain_sql_query] Analyzing: ${sql}`);

      const result = await db.execute(drizzleSql.raw(explainSql));

      return {
        plan: result.rows[0]['QUERY PLAN'],
        status: 'success',
        note: '请查看查询计划中的 "Actual Total Time" 以评估真实执行效率。',
      };
    } catch (error) {
      console.error('[explain_sql_query] Error:', error);
      return {
        status: 'error',
        message: error.message,
      };
    }
  },
};

/**
 * 清理 SQL 中标准函数 (EXTRACT, SUBSTRING, TRIM, OVERLAY) 内部的 FROM 关键字，
 * 将其替换为占位符以避免正则表名提取时误判。
 */
function cleanSqlOfFunctionFrom(sql) {
  let result = '';
  let stack = [];
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (inSingleQuote) {
      if (char === "'" && sql[i - 1] !== '\\') {
        inSingleQuote = false;
      }
      result += char;
      continue;
    }
    if (inDoubleQuote) {
      if (char === '"' && sql[i - 1] !== '\\') {
        inDoubleQuote = false;
      }
      result += char;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      result += char;
      continue;
    }
    if (char === '"') {
      inDoubleQuote = true;
      result += char;
      continue;
    }

    if (char === '(') {
      const before = sql.substring(0, i).trim();
      let state = 'other';
      if (/\b(EXTRACT|SUBSTRING|TRIM|OVERLAY)$/i.test(before)) {
        state = 'func';
      } else if (stack.length > 0 && stack[stack.length - 1] === 'func') {
        state = 'func';
      }
      stack.push(state);
      result += char;
      continue;
    }

    if (char === ')') {
      if (stack.length > 0) {
        stack.pop();
      }
      result += char;
      continue;
    }

    if (stack.length > 0 && stack[stack.length - 1] === 'func') {
      if (
        sql.substring(i, i + 4).toUpperCase() === 'FROM' &&
        /\s/.test(sql[i - 1] || '') &&
        /\s/.test(sql[i + 4] || '')
      ) {
        result += '____';
        i += 3;
        continue;
      }
    }

    result += char;
  }
  return result;
}

