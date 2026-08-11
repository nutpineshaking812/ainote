import mitt from 'mitt';

/**
 * SDK 事件总线 — 宿主页面通过 AiNoteChat.events 订阅全量运行时数据
 *
 * === 生命周期事件 ===
 *   ready                  { userId, token }                   鉴权完成
 *   auth:error             { message }                         鉴权失败
 *   employee:list          employees[]                         员工列表加载完成
 *   employee:select        employee object                     用户选中员工
 *   employee:dismiss       employee object                     用户关闭员工
 *   destroy                                                      SDK 实例销毁
 *
 * === 对话事件 ===
 *   chat:send              { content, employeeId, metadata }   用户发送消息
 *   chat:stream:done       { conversationId, fullText, ... }   流式回复完成
 *   chat:stream:abort      { conversationId }                  用户中止回复
 *
 * === 对话实时数据流（核心）===
 *   stream:event           { type, data, streamKey, conversationId, employeeId }
 *
 *     streamKey:       外部传入的 dock 唯一标识，代表数字员工来自哪个 dock 容器。
 *                      用于多 dock 场景下区分不同 dock 的事件流。
 *                      未经 host 配置时此字段可能为 undefined（不传则等价于单 dock 模式）。
 *
 *     conversationId:  后端返回的真实会话ID。首轮 SSE 事件中可能为 null，
 *                      当后端返回 data-conversation 事件后才有值。
 *
 *     employeeId:      当前回复的数字员工 ID。多员工 dock 场景下，
 *                      通过此字段区分不同员工的事件流（必选过滤维度）。
 *
 *     type 包括（目前已支持）:
 *       text-delta         文本增量       data.textDelta
 *       thinking-delta     思考增量       data.textDelta
 *       stage              阶段状态       data.content / data.nodeId
 *       node:progress      节点进度       同上
 *       tool-input-start   工具调用开始   data.toolName / data.toolCallId
 *       tool-input-delta   工具输入增量   data.inputTextDelta
 *       tool-input-available 工具输入完成 data.toolName / data.input
 *       tool-result        工具执行结果   data.output / data.result
 *       tool-output-available 工具输出可用 同 tool-result
 *       finish             流结束标记
 *       error              错误信息       data.error
 *       chart / data       图表/结构化数据
 *     未来流程编排中新增的自定义节点 type 也会通过此事件透传
 *
 * === 全量监听 ===
 *   AiNoteChat.events.on('*', (type, payload) => { console.log(type, payload); });
 *
 * === 用法示例 ===
 *   // 单对话场景：直接监听
 *   AiNoteChat.events.on('stream:event', ({ type, data }) => {
 *     if (type === 'text-delta') {
 *       outputEl.textContent += data.textDelta;
 *     }
 *   });
 *
 *   // 多员工场景：用 streamKey（dock 标识）+ employeeId 双重过滤
 *   // streamKey 区分不同 dock 容器，employeeId 区分 dock 内不同员工
 *   var targetEmployeeId = null;
 *
 *   AiNoteChat.init({ appId: '...', apiKey: '...' });
 *
 *   AiNoteChat.events.on('employee:select', function (emp) {
 *     targetEmployeeId = emp.id || emp._id;
 *   });
 *
 *   AiNoteChat.events.on('stream:event', function ({ type, data, streamKey, employeeId }) {
 *     // 只看目标员工
 *     if (employeeId !== targetEmployeeId) return;
 *
 *     if (type === 'text-delta') outputEl.textContent += data.textDelta;
 *   });
 *
 *   // 通配符监听全部事件（包括生命周期 + 对话）
 *   AiNoteChat.events.on('*', (eventType, payload) => {
 *     console.log(`[${eventType}]`, payload);
 *   });
 */
const sdkEventBus = mitt();

export default sdkEventBus;
