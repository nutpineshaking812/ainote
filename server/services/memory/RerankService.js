import axios from 'axios';
import env from '../../config/env.js';

/**
 * Service to handle Text Reranking using Alibaba DashScope (Qwen Rerank)
 */
export class RerankService {
  constructor() {
    this.apiKey = env.embeddingConfig?.apiKey; // 默认复用 Embedding 的 Key
    this.baseURL = 'https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank';
    this.model = 'qwen3-rerank';
  }

  /**
   * Rerank documents based on query relevance
   * @param {string} query The user's search query
   * @param {Array<{content: string}>} documents List of documents to rerank
   * @param {number} topN Number of documents to return
   * @returns {Promise<Array>} Reranked documents with scores
   */
  async rerank(query, documents, topN = 5) {
    if (!documents || documents.length === 0) return [];
    if (!query) return documents.slice(0, topN);

    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          input: {
            query: query,
            documents: documents.map(d => d.content)
          },
          parameters: {
            return_documents: true,
            top_n: topN
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10秒超时
        }
      );

      const results = response.data.output.results;
      
      // 将重排结果映射回原始对象
      return results.map(item => {
        const originalDoc = documents[item.index];
        return {
          ...originalDoc,
          score: item.relevance_score, // 覆盖 RRF 分数为更精准的语义分数
          rerankScore: item.relevance_score,
          index: item.index
        };
      });

    } catch (error) {
      console.error('Rerank Service Error:', error.response?.data || error.message);
      // 降级策略：如果 Rerank 失败，返回原列表的前 N 名（即 RRF 的结果）
      return documents.slice(0, topN);
    }
  }
}

export default new RerankService();
