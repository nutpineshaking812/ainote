// 数据分析Agent工具函数：提取与解析
import { extractJson } from '../../utils/stringUtils.js';


function extractStateJson(content = '') {
  if (typeof content !== 'string' || !content) return null;
  const matcher = /<intent>([\s\S]*?)<\/intent>/i;
  const match = content.match(matcher);
  if (!match) return null;
  const intentText = match[1]?.trim();
  if (!intentText) return null;
  try {
    const parsed = JSON.parse(intentText);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (e) {}
  return null;
}

function extractQueryComponents(content) {
  const jsonText = extractJson(content, '[QueryComponents]');
  if (!jsonText) return null;
  try {
    const parsed = JSON.parse(jsonText);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (e) {
    return {};
  }
}

function extractMongoQuery(content) {
  // 规则：以字面字符串 "[MongoQuery]" 为锚点，取其后出现的第一个 JSON（数组优先）。
  const marker = '[MongoQuery]';
  const rawJson = extractJson(content, marker);
  if (!rawJson) return null;
  return formatMongoQuery(rawJson);
}

function formatMongoQuery(rawJson) {
  // 规范化：ObjectId("<hex>") / new ObjectId("<hex>") => {"$oid":"<hex>"}
  let normalized = rawJson.replace(/ObjectId\(\s*['"]([0-9a-fA-F]{24})['"]\s*\)/g, '{"$oid":"$1"}');
  normalized = normalized.replace(
    /new\s+ObjectId\(\s*['"]([0-9a-fA-F]{24})['"]\s*\)/g,
    '{"$oid":"$1"}',
  );
  // 支持 ISODate("...") -> {"$date":"..."}
  normalized = normalized.replace(/ISODate\(\s*['"]([^'"]+)['"]\s*\)/g, '{"$date":"$1"}');
  // 支持 new Date("...") -> {"$date":"..."}
  normalized = normalized.replace(/new\s+Date\(\s*['"]([^'"]+)['"]\s*\)/g, '{"$date":"$1"}');

  try {
    const parsed = JSON.parse(normalized);

    // 递归替换 { "$oid": "<24hex>" } 为真正的 ObjectId 实例 + 日期恢复 {"$date":"..."}
    const reviveOids = (val) => {
      if (Array.isArray(val)) return val.map(reviveOids);
      if (val && typeof val === 'object') {
        // 独立的 { $oid: "..." }
        if (
          Object.keys(val).length === 1 &&
          typeof val.$oid === 'string' &&
          /^[0-9a-fA-F]{24}$/.test(val.$oid)
        ) {
          return val.$oid;
        }
        // 日期 { $date: "..." }
        if (Object.keys(val).length === 1 && typeof val.$date === 'string') {
          const dt = new Date(val.$date);
          if (!isNaN(dt.getTime())) return dt;
        }
        // 深度遍历
        for (const k of Object.keys(val)) {
          val[k] = reviveOids(val[k]);
        }
      }
      return val;
    };

    const extractArray = (root) => {
      if (Array.isArray(root)) return root;
      if (root?.pipeline && Array.isArray(root.pipeline)) return root.pipeline;
      if (root?.query && Array.isArray(root.query)) return root.query;
      return null;
    };

    let candidate = extractArray(parsed);
    if (!candidate) return null;
    candidate = reviveOids(candidate);
    const validation = validatePipelineStages(candidate);
    if (!validation.ok) return { __invalid_pipeline: true, reason: validation.reason };
    if (validation.warning) {
      // 将警告信息放入不可枚举属性，避免污染序列化
      Object.defineProperty(candidate, '__pipeline_warning', {
        value: validation.warning,
        enumerable: false,
      });
    }
    return candidate;
  } catch (e) {
    return null;
  }
  return null;
}

/**
 * MongoDB 聚合管道安全与合法性校验工具
 * 提供:
 *  - ALLOWED_AGG_STAGES 白名单
 *  - FORBIDDEN_AGG_STAGES 禁止执行阶段
 *  - validatePipelineStages 主校验
 *  - classifyStage 辅助分类
 * 设计目标: 可复用、可扩展、低耦合。
 */

const ALLOWED_AGG_STAGES = new Set([
  '$match',
  '$project',
  '$group',
  '$sort',
  '$limit',
  '$skip',
  '$lookup',
  '$unwind',
  '$addFields',
  '$set',
  '$unset',
  '$count',
  '$facet',
  '$replaceRoot',
  '$replaceWith',
]);

const FORBIDDEN_AGG_STAGES = new Set(['$out', '$merge', '$function', '$accumulator', '$where']);

/**
 * 对阶段进行分类
 * @param {string} op
 * @returns {'allowed'|'forbidden'|'warn'|'invalid'}
 */
function classifyStage(op) {
  if (!op || typeof op !== 'string' || !op.startsWith('$')) return 'invalid';
  if (FORBIDDEN_AGG_STAGES.has(op)) return 'forbidden';
  if (ALLOWED_AGG_STAGES.has(op)) return 'allowed';
  return 'warn';
}

/**
 * 校验聚合管道数组合法性与安全性
 * @param {Array} pipeline
 * @returns {{ ok:boolean, reason?:string, warning?:string }}
 */
function validatePipelineStages(pipeline) {
  if (!Array.isArray(pipeline)) return { ok: false, reason: 'Pipeline is not an array' };
  for (const stage of pipeline) {
    if (!stage || typeof stage !== 'object') return { ok: false, reason: 'Stage is not an object' };
    const keys = Object.keys(stage);
    if (keys.length !== 1)
      return { ok: false, reason: 'Each stage must have exactly one operator key' };
    const op = keys[0];
    const classification = classifyStage(op);
    if (classification === 'invalid') return { ok: false, reason: `Invalid stage operator: ${op}` };
    if (classification === 'forbidden')
      return { ok: false, reason: `Forbidden stage operator: ${op}` };
    if (classification === 'warn')
      return { ok: true, warning: `Non-whitelisted stage encountered: ${op}` };
  }
  return { ok: true };
}

export { extractStateJson, extractMongoQuery, extractQueryComponents, formatMongoQuery };
