import { z } from 'zod';
import { db } from '../../../db/index.js';
import { sql as drizzleSql } from 'drizzle-orm';
import ApiError from '../../../utils/ApiError.js';

/**
 * SQL 执行工具 (PostgreSQL)
 */
export const executeSqlQuery = {
  name: 'execute_sql_query',
  description:
    '执行 SQL SELECT 查询以从 PostgreSQL 数据库中检索数据。仅限 SELECT 语句。当需要执行复杂的聚合或多字段筛选时使用。',
  inputSchema: z.object({
    sql: z.string().describe('要执行的 SQL SELECT 语句'),
  }),
  execute: async ({ sql }, context) => {
    if (!sql) throw ApiError.badRequest('缺少 SQL 语句');

    // 基础安全性检查：仅允许 SELECT
    const trimmedSql = sql.trim().toUpperCase();
    if (!trimmedSql.startsWith('SELECT')) {
      throw ApiError.badRequest('仅允许执行 SELECT 查询语句以确保数据安全');
    }

    // 严格限制：只能检索白名单中的表
    const TABLE_WHITELIST = ['form_records', 'lc.form_records'];

    // 清理 SQL 中标准函数里的 FROM 关键字 (如 EXTRACT/SUBSTRING/TRIM/OVERLAY) 以免误判为表名
    const cleanedSql = cleanSqlOfFunctionFrom(sql);

    // 匹配 FROM 或 JOIN 后的表名，允许可选的 schema 前缀并支持双引号标识符（如 "lc"."form_records"）以及转义格式
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
        `SQL 包含非白名单表: ${unauthorizedTables.join(', ')}。仅允许访问: ${TABLE_WHITELIST.join(', ')}`,
      );
    }

    try {
      console.log(`[execute_sql_query] Executing: ${sql}`);
      const result = await db.execute(drizzleSql.raw(sql));

      return {
        rows: result.rows,
        count: result.rows.length,
        status: 'success',
      };
    } catch (error) {
      console.error('[execute_sql_query] Error:', error);
      return {
        status: 'error',
        message: error.message,
        hint: '请检查表名、字段名及 SQL 语法是否正确。注意表名通常包含 schema 前缀（如 lc.form_records）。',
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

