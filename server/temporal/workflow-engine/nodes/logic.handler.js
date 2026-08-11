/**
 * workflow-engine/nodes/logic.handler.js
 *
 * Handles pure control-flow node types:
 *   if, while, for, waitUpdate, trigger, end
 *
 * Each handler receives (resolvedData, ctx) and returns { result, nextHandleId }.
 * ctx provides: { node, nodes, edges, nodeResults, triggerData, loopStates, latestFormDataRef, condition, log }
 *
 * NOTE: No dynamic import() — static imports only (Temporal VM sandbox restriction).
 */
import { ApplicationFailure } from '@temporalio/workflow';
import { evaluateCondition } from '../resolver.js';

export async function handleIf(resolvedData, ctx) {
  const isTrue = evaluateCondition(resolvedData.condition, ctx.nodeResults, ctx.triggerData);
  return {
    result: { condition: resolvedData.condition, evaluation: isTrue },
    nextHandleId: isTrue ? 'true' : 'false',
  };
}

export async function handleWhile(resolvedData, ctx) {
  const isTrue = evaluateCondition(resolvedData.condition, ctx.nodeResults, ctx.triggerData);
  return {
    result: { condition: resolvedData.condition, evaluation: isTrue },
    nextHandleId: isTrue ? 'loop' : 'exit',
  };
}

export async function handleFor(resolvedData, ctx) {
  const { node, loopStates } = ctx;
  let state = loopStates.get(node.id);
  if (!state) {
    const items = Array.isArray(resolvedData.iterator)
      ? resolvedData.iterator
      : typeof resolvedData.limit === 'number'
        ? Array.from({ length: resolvedData.limit })
        : [];
    state = { index: 0, items };
    loopStates.set(node.id, state);
  }

  if (state.index < state.items.length) {
    const result = {
      index: state.index,
      item: state.items[state.index],
      total: state.items.length,
    };
    state.index++;
    return { result, nextHandleId: 'loop' };
  } else {
    loopStates.delete(node.id);
    return { result: { finished: true, total: state.items.length }, nextHandleId: 'exit' };
  }
}

export async function handleWaitUpdate(resolvedData, ctx) {
  const { condition, latestFormDataRef } = ctx;
  const timeout = resolvedData.timeout || 3600;
  const received = await condition(() => latestFormDataRef.value !== null, timeout * 1000);
  if (!received) throw new Error(`Wait timed out after ${timeout} seconds`);
  const data = latestFormDataRef.value;
  latestFormDataRef.value = null;
  return { result: { success: true, data, receivedAt: new Date() } };
}

export async function handleTrigger(resolvedData, ctx) {
  const { triggerData, log } = ctx;
  const triggerInputs = resolvedData.inputs || [];

  // 1. 创建干净的结果对象，保留原始触发数据并增加时间戳
  const result = {
    ...triggerData,
    triggeredAt: new Date().toISOString(),
  };

  // 2. 核心逻辑：强制参数校验 + 跨层级自动提取 (Auto-Mapping)
  if (triggerInputs.length > 0) {
    log.info(
      `[LogicHandler] Mapping/Validating trigger data against ${triggerInputs.length} defined inputs`,
    );

    for (const p of triggerInputs) {
      if (!p.name) continue;

      // 智能提取逻辑：优先从触发数据提取，其次检测 Webhook/DataChange 特定 Payload，最后采纳默认值
      let value = triggerData[p.name];

      if (value === undefined || value === null) {
        if (triggerData.triggerType === 'WEBHOOK' && triggerData.data) {
          value = triggerData.data.body?.[p.name] ?? triggerData.data.query?.[p.name];
        } else if (triggerData.triggerType === 'DATACHANGE' && triggerData.data) {
          value = triggerData.data.record?.[p.name];
        }
      }

      // 如果依然缺失且存在默认值，则注入默认值 (Injection of Default)
      if ((value === undefined || value === null) && p.default !== undefined) {
        value = p.default;
      }

      // 录入结果根部，方便 {{nodes.trigger.paramName}} 直接引用
      if (value !== undefined && value !== null) {
        result[p.name] = value;
      }

      // 校验必填性
      if (
        p.required &&
        (result[p.name] === undefined || result[p.name] === null || result[p.name] === '')
      ) {
        log.error(`[LogicHandler] Missing required parameter: ${p.name}`);
        throw ApplicationFailure.create({
          message: `Validation Failed: Missing required parameter "${p.name}"`,
          type: 'ValidationError',
          nonRetryable: true,
        });
      }
    }
  }

  // 重要：不再使用 Object.assign(triggerData, resolvedData)，防止配置泄露到结果中
  return { result };
}

export async function handleEnd(resolvedData, ctx) {
  const { log } = ctx;
  log.info('[LogicHandler] Reached final End node', { result: resolvedData });

  // 🏆 核心优化：将 outputs 数组转换为干净的键值对对象 (Key-Value Object)
  const outputs = resolvedData.outputs || [];
  const cleanResult = {};
  if (Array.isArray(outputs)) {
    for (const out of outputs) {
      if (out.name) {
        cleanResult[out.name] = out.value;
      }
    }
  } else {
    Object.assign(cleanResult, outputs);
  }

  return {
    result: cleanResult,
    isFinal: true, // Special flag for runner to exit immediately
  };
}
