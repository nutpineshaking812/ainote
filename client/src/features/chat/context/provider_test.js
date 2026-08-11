/*
 * 单元测试脚本：provider_test.js
 * 使用用户提供的真实数据还原黑屏现场并调试
 */

const randomId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * 核心解析逻辑
 */
function transformMessage(chunk, originMessage) {
  if (!chunk || chunk.data === ' [DONE]' || !chunk.data) return originMessage;
  const payload = JSON.parse(chunk.data);
  if (!payload) return originMessage;

  // 初始化 parts
  if (!originMessage.parts) originMessage.parts = [];
  const parts = [...originMessage.parts];
  let lastPart = parts[parts.length - 1];

  const eventType = payload.type;

  switch (eventType) {
    case 'text-delta': {
      let content = payload.textDelta || payload.content || '';

      // 解析 <think> 和 </think> 标签的逻辑 (流式鲁棒版)
      if (content.indexOf('<think>') !== -1) {
        originMessage._in_thinking = true;
        const [before, after] = content.split('<think>');
        // 如果标签前有文字 (很少见)，存入正文
        if (before) {
          if (lastPart && lastPart.type === 'text' && lastPart.status === 'loading') {
            lastPart.content += before;
          } else {
            parts.push({ type: 'text', content: before, status: 'success' });
          }
        }
        // 开启思考态
        parts.push({ type: 'think', content: after || '', status: 'loading' });
      } else if (content.indexOf('</think>') !== -1) {
        originMessage._in_thinking = false;
        const [before, after] = content.split('</think>');
        // 结束思考态
        if (lastPart && lastPart.type === 'think') {
          lastPart.content += before;
          lastPart.status = 'success';
        }
        // 开启正文态
        parts.push({ type: 'text', content: after || '', status: 'loading' });
      } else {
        // 普通增量
        if (originMessage._in_thinking) {
          if (lastPart && lastPart.type === 'think') {
            lastPart.content += content;
          } else {
            parts.push({ type: 'think', content, status: 'loading' });
          }
        } else {
          if (lastPart && lastPart.type === 'text' && lastPart.status === 'loading') {
            lastPart.content += content;
          } else {
            parts.push({ type: 'text', content, status: 'loading' });
          }
        }
      }
      break;
    }
    case 'tool-input-start':
    case 'node:start': {
      if (lastPart) lastPart.status = 'success';
      const key = payload.toolCallId || payload.nodeId || randomId('thought');
      const title = payload.toolName || payload.nodeName || '执行中...';
      parts.push({
        type: 'thoughts',
        status: 'loading',
        items: [{ key, title, status: 'loading', description: '' }],
      });
      break;
    }
    case 'tool-output-available':
    case 'node:success': {
      if (lastPart && lastPart.type === 'thoughts' && lastPart.items) {
        const items = [...lastPart.items];
        const lastItem = items[items.length - 1];
        if (lastItem) {
          lastItem.status = 'success';
        }
        lastPart.items = items;
        lastPart.status = 'success';
      }
      break;
    }
    // 其他 case ...
  }

  return { ...originMessage, parts };
}

// --- 注入用户的 Mock 数据 ---
const mockLines = [
  'data: {"type":"start"}',
  'data: {"type":"data-conversation","data":{"conversationId":"69bfabdc937d3b01faec3a7f","messageId":"69bfabdc937d3b01faec3a84","title":"默认名字"}}',
  'data: {"type":"start-step"}',
  'data: {"type":"text-delta","content":"<think>","delta":"<think>","textDelta":"<think>"}',
  'data: {"type":"text-delta","content":"好的，用户，让我想想","delta":"好的，用户，让我想想","textDelta":"好的，用户，让我想想"}',
  'data: {"type":"text-delta","content":"</think>","delta":"</think>","textDelta":"</think>"}',
  'data: {"type":"text-delta","content":"这是最终正文","delta":"这是最终正文","textDelta":"这是最终正文"}',
];

// --- 最终执行 ---
console.log('=== 启动数据流测试 ===');
let msg = { role: 'assistant' };

mockLines.forEach((line) => {
  const data = line.replace('data: ', '');
  if (data === '[DONE]') return;
  msg = transformMessage({ data }, msg);
  console.log(`[EVENT] parts length: ${msg.parts.length}, in_thinking: ${!!msg._in_thinking}`);
});

console.log('\n[FINAL RESULTS]');
console.log(JSON.stringify(msg.parts, null, 2));
