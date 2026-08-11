import env from '../../../config/env.js';

// 强制在 ESM 模块顶层关闭遥感，防止网络阻塞
process.env.MEM0_TELEMETRY = 'false';

// 1. 全局单例 Promise，确保高并发时也只初始化一次，且支持异步初始化
async function getMemoryInstance() {
  if (!global._mem0RecallInstancePromise) {
    global._mem0RecallInstancePromise = (async () => {
      console.log('[Mem0 Recall] Starting async initialization with patch...');

      const { Memory, PGVector } = await import('mem0ai/oss');

      // 🛡️ 核心修复：Monkey Patch PGVector 的初始化方法，彻底解决并发连接 Bug
      if (PGVector && PGVector.prototype && !PGVector.prototype._isPatched) {
        const originalInit = PGVector.prototype.initialize;
        PGVector.prototype.initialize = async function () {
          if (this._initPromise) return this._initPromise;
          this._initPromise = originalInit.apply(this, arguments);
          return this._initPromise;
        };
        PGVector.prototype._isPatched = true;
        console.log('[Mem0 Recall] PGVector initialization patch applied.');
      }

      const config = {
        version: 'v1.1',
        llm: {
          provider: 'openai',
          config: {
            apiKey: env.llmProviders.qwen.apiKey,
            baseURL: env.llmProviders.qwen.baseURL,
            model: env.llmProviders.qwen.model || 'gpt-4o',
            extra_body: {
              include_reasoning: false,
              enable_thinking: false,
            },
          },
        },
        embedder: {
          provider: 'openai',
          config: {
            apiKey: env.embeddingConfig.apiKey,
            baseURL: env.embeddingConfig.baseURL,
            model: env.embeddingConfig.model || 'text-embedding-3-small',
          },
        },
        vectorStore: (() => {
          const provider = process.env.MEMORY_PROVIDER || 'qdrant';
          if (provider === 'postgres' || provider === 'pgvector') {
            const url = new URL(process.env.VECTOR_POSTGRES_URL);
            return {
              provider: 'pgvector',
              config: {
                user: url.username,
                password: decodeURIComponent(url.password),
                host: url.hostname,
                port: parseInt(url.port) || 5432,
                dbname: url.pathname.slice(1),
                collectionName: 'mem0',
                embeddingModelDims: env.embeddingConfig.dimension,
                dimension: env.embeddingConfig.dimension,
              },
            };
          }
          return {
            provider: provider,
            config: {
              url: process.env.QDRANT_URL || 'http://localhost:6333',
              collectionName: 'mem0',
              dimension: env.embeddingConfig.dimension,
              checkCompatibility: false,
            },
          };
        })(),
        // 🚀 核心优化 2：关闭历史记录管理以减少 IO 负担
        disableHistory: true,
        historyDbPath: '../memory.db',
      };

      const instance = new Memory(config);
      // 等待内部加载（虽然 Memory constructor 是同步的，但内部有 _initPromise）
      if (instance._initPromise) await instance._initPromise;

      console.log('[Mem0 Recall] Singleton instance ready.');
      return instance;
    })();
  }
  return global._mem0RecallInstancePromise;
}

/**
 * Mem0 Recall Handler (High Performance)
 */
export async function handler(params, ctx) {
  const { query, userId, limit = 5 } = params;
  const actualUserId = userId || ctx.triggerData?.userId || 'anonymous';

  if (!query) throw new Error('Query is required');

  try {
    const memory = await getMemoryInstance();
    const start = Date.now();

    // 执行搜索
    const rawResponse = await memory.search(query, { userId: actualUserId, limit });

    const results = Array.isArray(rawResponse) ? rawResponse : rawResponse.results || [];

    const formattedText = results
      .map((item, idx) => `[${idx + 1}] ${item.memory || item.content}`)
      .join('\n');

    console.log(`[Mem0 Recall] Search finished in ${Date.now() - start}ms`);

    return {
      success: true,
      result: {
        results: results,
        text: formattedText,
        count: results.length,
      },
    };
  } catch (err) {
    console.error('[Mem0 Recall] Failed:', err);
    throw err;
  }
}
