import env from '../../../config/env.js';

// 1. 强制在 ESM 顶层设置遥感关闭
process.env.MEM0_TELEMETRY = 'false';

// 2. 异步单例 Promise
async function getMemoryInstance() {
  if (!global._mem0DistillInstancePromise) {
    global._mem0DistillInstancePromise = (async () => {
      console.log('[Mem0 Distill] Starting async initialization with patch...');

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
        console.log('[Mem0 Distill] PGVector initialization patch applied.');
      }

      const config = {
        version: 'v1.1',
        llm: {
          provider: 'openai',
          config: {
            apiKey: env.llmProviders.qwen.apiKey,
            baseURL: env.llmProviders.qwen.baseURL,
            model: 'qwen-turbo',
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
        disableHistory: true,
        historyDbPath: '../memory.db',
      };

      const instance = new Memory(config);
      if (instance._initPromise) await instance._initPromise;

      console.log('[Mem0 Distill] Singleton instance ready.');
      return instance;
    })();
  }
  return global._mem0DistillInstancePromise;
}

/**
 * Mem0 Distill (Store) Handler (High Performance)
 */
export async function handler(params, ctx) {
  const { content, userId, metadata = '{}' } = params;
  const actualUserId = userId || ctx.triggerData?.userId || 'anonymous';

  if (!content) throw new Error('Content is required');

  let parsedMetadata = {};
  if (typeof metadata === 'string') {
    try {
      parsedMetadata = JSON.parse(metadata);
    } catch (e) {
      parsedMetadata = { raw: metadata };
    }
  } else {
    parsedMetadata = metadata;
  }

  try {
    const memory = await getMemoryInstance();
    const start = Date.now();

    // 执行存储与对齐逻辑
    const result = await memory.add(content, { userId: actualUserId, metadata: parsedMetadata });

    const extractedList = Array.isArray(result)
      ? result
      : result.results || result.memories || [result];

    console.log(`[Mem0 Distill] Add finished in ${Date.now() - start}ms`);

    return {
      success: true,
      result: {
        success: true,
        extractedItems: extractedList,
        count: extractedList.length,
      },
    };
  } catch (err) {
    console.error('[Mem0 Distill] Failed:', err);
    throw err;
  }
}
