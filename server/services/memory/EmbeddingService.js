import { OpenAIEmbeddings } from '@langchain/openai';
import env from '../../config/env.js';

/**
 * Service to handle Text-to-Vector embeddings
 */
export class EmbeddingService {
  constructor(config = {}) {
    const { embeddingConfig } = env;
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.apiKey || embeddingConfig.apiKey,
      configuration: {
        baseURL: embeddingConfig.baseURL || undefined,
      },
      modelName: config.modelName || embeddingConfig.model,
    });
  }

  /**
   * Embed a single string
   * @param {string} text
   * @returns {Promise<Array<number>>}
   */
  async embedQuery(text) {
    if (!text) return [];
    let resolvedText = text;
    if (Array.isArray(text)) {
      const textItem = text.find((item) => item.type === 'text');
      resolvedText = textItem ? textItem.text : '';
    } else if (typeof text !== 'string') {
      try {
        resolvedText = JSON.stringify(text);
      } catch (e) {
        resolvedText = String(text);
      }
    }
    return await this.embeddings.embedQuery(resolvedText);
  }

  async embedDocuments(texts) {
    if (!texts || texts.length === 0) return [];
    if (texts.length <= 10) {
      return await this.embeddings.embedDocuments(texts);
    }
    const batchSize = 10;
    const results = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await this.embeddings.embedDocuments(batch);
      results.push(...batchResults);
    }
    return results;
  }
}

export default new EmbeddingService();
