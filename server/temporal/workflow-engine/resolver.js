/**
 * workflow-engine/resolver.js
 *
 * Pure function: resolves {{nodeId.property}} template variables in node data.
 * No side effects, no Temporal imports — fully unit testable.
 */

/**
 * Build a lookup context from nodeResults + triggerData.
 */
function buildContext(contextMap, triggerData, previousNodeId) {
  const context = { trigger: triggerData, nodes: {} };

  // Inject system date/time variables
  const now = new Date();
  context['now'] = now.toISOString();
  context['today'] = now.toISOString().split('T')[0];
  context['date'] = {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, '0'),
    day: String(now.getDate()).padStart(2, '0'),
  };

  for (const [key, val] of contextMap.entries()) {
    const unwrapped =
      val && typeof val === 'object' && 'result' in val && 'resolvedConfig' in val
        ? val.result
        : val;
    context[key] = unwrapped;
    context.nodes[key] = { output: unwrapped };
  }

  if (previousNodeId && context[previousNodeId]) {
    context['previousNode'] = context[previousNodeId];
  }

  return context;
}

/**
 * Walk a dot-path through a context object, with `.output` shortcut skipping.
 */
function walkPath(context, parts) {
  let current = context;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!current) break;
    if (part === 'output' && current.output === undefined && i < parts.length - 1) continue;
    if (current[part] !== undefined) {
      current = current[part];
    } else if (current.output && current.output[part] !== undefined) {
      current = current.output[part];
    } else {
      current = undefined;
      break;
    }
  }
  return current;
}

/**
 * Resolve a single value (recursively handles arrays and plain objects).
 */
function resolveValue(val, context) {
  if (typeof val !== 'string') {
    if (Array.isArray(val)) return val.map((v) => resolveValue(v, context));
    if (val !== null && typeof val === 'object') {
      const res = {};
      for (const key in val) res[key] = resolveValue(val[key], context);
      return res;
    }
    return val;
  }

  if (!val.includes('{{')) return val;

  const trimmed = val.trim();
  const isSingleVar =
    trimmed.startsWith('{{') && trimmed.endsWith('}}') && trimmed.indexOf('{{', 2) === -1;

  const replacer = (match, path) => {
    const pipeParts = path.trim().split('|');
    const varPath = pipeParts[0].trim();
    const filters = pipeParts.slice(1).map((f) => f.trim());

    let current = walkPath(context, varPath.split('.'));

    if (current === undefined) {
      return isSingleVar ? undefined : match;
    }

    for (const filter of filters) {
      if (!filter) continue;

      // =========================================================================
      // ─── Filter 1: | str / | string (Serialization / Stringify) ──────────────
      // 用途: 强转为标准的 JSON 序列化字符串。防止复杂对象插入文本时变成无意义的 "[object Object]"
      // 用例与表现:
      //   - 输入为对象: { a: 1 } -> 输出为字符串 '{"a":1}'
      //   - 输入已经是 JSON 字符串: '{"a":1}' -> 保持原样返回，彻底防止被二次转义/双重序列化
      // 范例: "Prompt: {{db_query.result | str}}" -> 优雅替换为展开后的 JSON 文本
      // =========================================================================
      if (filter === 'str' || filter === 'string') {
        if (typeof current !== 'string') {
          try {
            current = JSON.stringify(current);
          } catch (e) {
            current = String(current);
          }
        }
      }

      // =========================================================================
      // ─── Filter 2: | json (Smart Dual-Direction Object/String Converter) ──────
      // 用途: 智能双向转换。确保输出在单变量或插值拼接上下文中符合最佳 JSON 表现形式
      // 用例与表现:
      //   - 输入为符合 JSON 格式的字符串: '{"intent":"freeTalk"}' -> 智能反序列化为 JS 对象 { intent: "freeTalk" }
      //   - 输入为实际的 JS 对象/数组: { a: 1 } -> 智能序列化为 JSON 字符串 '{"a":1}'
      // 范例:
      //   1. 纯对象引用: "{{http_node.body | json}}" (单变量) -> 反序列化为实际 Object 供下游提取属性
      //   2. 文本拼接上下文: "data: {{n1.obj | json}}" (非单变量) -> 优雅替换并转义为 JSON 字符串展开
      // =========================================================================
      else if (filter === 'json' || filter.startsWith('json.')) {
        if (typeof current === 'string') {
          try {
            current = JSON.parse(current); // 尝试反序列化为真实的 JSON 对象
          } catch (e) {
            // 若不是合法的 JSON 字符串，保持原样文本
          }
        }

        // 支持 json.field.subField 形式的深层级提取
        if (filter.startsWith('json.')) {
          const subPath = filter.substring(5); // 提取 "json." 后面的路径，例如 "intent"
          if (current !== null && typeof current === 'object') {
            current = walkPath(current, subPath.split('.'));
          } else {
            current = undefined;
          }
        } else if (current !== null && typeof current === 'object' && !isSingleVar) {
          try {
            current = JSON.stringify(current); // 或者是纯 json 过滤器且在字符串拼接上下文中，序列化为字符串
          } catch (e) {
            current = '"[Circular Object]"';
          }
        }
      }

      // =========================================================================
      // ─── Filter 3: | date:FORMAT (Date Formatting) ───────────────────────────
      // 用途: 将日期时间类型转为指定格式的字符串表现形式。
      // 支持占位符:
      //   - YYYY: 四位年份 (如 2026)
      //   - MM: 两位月份 (如 05)
      //   - DD: 两位日期 (如 19)
      //   - HH: 两位小时 (如 11)
      //   - mm: 两位分钟 (如 28)
      //   - ss: 两位秒数 (如 30)
      // 范例: "{{date.now | date:YYYY-MM-DD HH:mm:ss}}" -> 展开为 "2026-05-19 11:28:30"
      // =========================================================================
      else if (filter.startsWith('date:')) {
        const formatStr = filter.substring(5);
        const d = new Date(current);
        if (!isNaN(d.getTime())) {
          current = formatStr
            .replace(/YYYY/g, d.getFullYear())
            .replace(/MM/g, String(d.getMonth() + 1).padStart(2, '0'))
            .replace(/DD/g, String(d.getDate()).padStart(2, '0'))
            .replace(/HH/g, String(d.getHours()).padStart(2, '0'))
            .replace(/mm/g, String(d.getMinutes()).padStart(2, '0'))
            .replace(/ss/g, String(d.getSeconds()).padStart(2, '0'));
        }
      }
    }

    if (typeof current === 'object' && !isSingleVar) {
      try {
        return JSON.stringify(current);
      } catch (e) {
        return '[Circular Object]';
      }
    }
    return current;
  };

  console.log('=======>', val, replacer);
  if (isSingleVar) {
    const path = trimmed.substring(2, trimmed.length - 2);
    return replacer(val, path);
  }
  return val.replace(/\{\{([^}]+)\}\}/g, replacer);
}

/**
 * Main export: resolves all template variables in a node's data object.
 */
export function resolveVariables(
  data,
  contextMap,
  triggerData = {},
  previousNodeId = null,
  currentNodeId = null,
) {
  if (!data) return data;
  const context = buildContext(contextMap, triggerData, previousNodeId);
  const finalResult = resolveValue(data, context);
  // console.log('[Workflow] Variables resolved', {
  //   nodeId: currentNodeId,
  //   inputKeys: data ? Object.keys(data) : [],
  //   outputKeys: finalResult && typeof finalResult === 'object' ? Object.keys(finalResult) : [],
  // });
  return finalResult;
}

/**
 * Evaluate a condition expression (for if/while nodes).
 */
export function evaluateCondition(expression, contextMap, triggerData = {}) {
  if (!expression) return false;
  const context = buildContext(contextMap, triggerData, null);
  const resolvedExpr = expression.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const parts = path.trim().split('.');
    const current = walkPath(context, parts);
    if (current === undefined) return 'undefined';
    // 采用 JSON.stringify 能自动处理引号、特殊字符转义以及各种基本数据类型，防止注入错误
    return JSON.stringify(current);
  });

  try {
    const result = !!new Function(`return (${resolvedExpr})`)();
    console.log(`[Workflow] Condition evaluated: "${resolvedExpr}" => ${result}`);
    return result;
  } catch (e) {
    console.error(`Failed to evaluate condition: ${resolvedExpr}`, e.message);
    return false;
  }
}
