/**
 * Sleep Plugin Handler
 *
 * 通过返回 `__sleepAfter` 标识，通知 workflow 引擎使用 Temporal 原生 sleep() 挂起。
 * 这是一种通用能力：任何插件都可以在返回值中携带 `__sleepAfter` 字段来触发延迟。
 *
 * 支持抖动（jitter）：实际延迟在基准值 ± jitter 范围内随机。
 *   例如 seconds=10, jitter=0.3 → 实际延迟在 7~13 秒之间随机。
 *
 * 执行流程：
 *   1. Activity 执行此 handler（极轻量，计算实际延迟秒数）
 *   2. workflow 层检测到 __sleepAfter，调用 Temporal sleep() 挂起（不占用 Worker）
 *   3. sleep 到期后继续执行下一个节点
 */
export async function handler(params, ctx) {
  const rawSeconds = params.seconds ?? params.pluginParams?.seconds ?? 5;
  const baseSeconds = Math.max(1, Math.min(300, Number(rawSeconds) || 5));

  const rawJitter = params.jitter ?? params.pluginParams?.jitter ?? 0;
  const jitter = Math.max(0, Math.min(1, Number(rawJitter) || 0));

  // 计算实际延迟：base ± base * jitter
  const offset = baseSeconds * jitter;
  const actualSeconds =
    jitter > 0
      ? baseSeconds - offset + Math.random() * 2 * offset
      : baseSeconds;

  // 保留 1 位小数，并确保不低于 1 秒
  const finalSeconds = Math.max(1, Math.round(actualSeconds * 10) / 10);

  ctx.logger.info(
    `[SleepPlugin] Requesting Temporal sleep: base=${baseSeconds}s, jitter=${jitter}, actual=${finalSeconds}s`,
  );

  return {
    success: true,
    __sleepAfter: finalSeconds, // 通用标识，workflow 引擎识别后执行 Temporal sleep
    result: {
      seconds: baseSeconds,
      actualSeconds: finalSeconds,
      jitter,
    },
  };
}
