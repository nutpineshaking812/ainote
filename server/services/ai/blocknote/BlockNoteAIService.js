import {
  injectDocumentStateMessages,
  aiDocumentFormats,
  toolDefinitionsToToolSet,
} from '@blocknote/xl-ai/server';
import { runBlockNoteGraph } from '../../../agent/core/buildBlockNoteGraph.js';
import { AIBaseService } from '../base/AIBaseService.js';
import { EMPLOYEE_SCENARIOS } from '../../../constants/digitalEmployee.js';
import crypto from 'crypto';

/**
 * BlockNote AI 专用服务
 */
export class BlockNoteAIService extends AIBaseService {
  constructor({ userId, appId }) {
    super({ userId, appId, scenario: EMPLOYEE_SCENARIOS.DOCUMENT, enablePersistence: false });
  }

  /**
   * 执行 BlockNote 的 LangGraph 逻辑
   */
  async *executeAgent({ messages, toolDefinitions }) {
    // 1. 处理 BlockNote 特有的消息注入
    const processedMessages = injectDocumentStateMessages(messages);

    // 2. 获取系统提示 (默认使用 html 格式)
    const systemPrompt = aiDocumentFormats.html.systemPrompt;

    // 3. 构建一个模拟 Graph 对象以复用 UniversalGraphRunner
    // 这样可以在不彻底重构其逻辑的前提下，享受统一的流处理
    const mockGraph = {
      streamEvents: (inputState) =>
        runBlockNoteGraph(
          processedMessages,
          toolDefinitionsToToolSet(toolDefinitions),
          systemPrompt,
          { userId: this.userId, appId: this.appId, taskId: inputState.taskId },
        ),
    };

    yield* this.streamUniversalGraph(mockGraph, {
      taskId: crypto.randomUUID(),
    });
  }
}
