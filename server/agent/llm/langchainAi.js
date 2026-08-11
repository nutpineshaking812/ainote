import { ChatOpenAI } from '@langchain/openai';
import { ChatDeepSeek } from '@langchain/deepseek';
import env from '../../config/env.js';
import { TokenUsageCallbackHandler } from '../utils/tokenTracker.js';

// Provider factory with provider-specific settings
const providerFactories = {
  openai: (config, { userId, orgId, appId, runName, taskId, jsonMode, temperature }) =>
    new ChatOpenAI({
      modelName: config.model || 'gpt-4o',
      temperature: temperature ?? 0,
      apiKey: config.apiKey,
      configuration: { baseURL: config.baseURL },
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      callbacks: [
        new TokenUsageCallbackHandler({
          userId,
          orgId,
          modelName: config.model,
          appId,
          runName,
          taskId,
        }),
      ],
    }),

  qwen: (
    config,
    { userId, orgId, appId, runName, taskId, enable_thinking, enable_search, jsonMode, temperature },
  ) =>
    new ChatDeepSeek({
      model: config.model || 'qwen-plus',
      temperature: temperature ?? 0,
      apiKey: config.apiKey,
      configuration: { baseURL: config.baseURL },
      // Provider-specific settings
      modelKwargs: {
        enable_thinking: enable_thinking ?? false,
        enable_search: enable_search ?? false,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      },
      callbacks: [
        new TokenUsageCallbackHandler({
          userId,
          orgId,
          modelName: config.model,
          appId,
          runName,
          taskId,
        }),
      ],
    }),

  oneapi: (config, { userId, orgId, appId, runName, taskId, jsonMode, temperature }) =>
    new ChatOpenAI({
      modelName: config.model || 'oneapi',
      temperature: temperature ?? 0,
      apiKey: config.apiKey,
      configuration: { baseURL: config.baseURL },
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      callbacks: [
        new TokenUsageCallbackHandler({
          userId,
          orgId,
          modelName: config.model,
          appId,
          runName,
          taskId,
        }),
      ],
    }),
};

/**
 * Get list of explicitly supported provider keys
 */
export function getSupportedProviders() {
  return Object.keys(providerFactories);
}

/**
 * Create a LangChain LLM instance based on the specified provider
 * @param {string} providerName - The name of the provider (e.g., 'openai', 'qwen')
 *                                If not specified, uses LLM_DEFAULT_PROVIDER from env
 * @param {Object} options - Configuration options
 * @param {string} options.userId - User ID for token tracking
 * @param {string} options.orgId - Organization ID for token tracking
 * @param {string} options.appId - App ID for token tracking
 * @param {string} options.runName - Name of the run for identification
 * @param {string} options.taskId - Task ID for grouping multiple calls
 * @returns {ChatOpenAI|ChatDeepSeek} - The configured LLM instance
 */
export function createLLM(
  providerName,
  {
    enable_thinking = true,
    enable_search = true,
    jsonMode = false,
    temperature,
    userId,
    orgId,
    appId,
    runName,
    taskId,
  } = {},
) {
  let provider = providerName || env.LLM_DEFAULT_PROVIDER;
  let targetModel = null;

  // Support "provider:model" syntax
  if (typeof provider === 'string' && provider.includes(':')) {
    const parts = provider.split(':');
    provider = parts[0];
    targetModel = parts[1];
  }

  // Auto-detect provider if the input is a specific model name
  if (!env.llmProviders[provider]) {
    for (const [pName, pConfig] of Object.entries(env.llmProviders)) {
      if (pConfig.models?.includes(provider)) {
        targetModel = provider;
        provider = pName;
        break;
      }
    }
  }

  const rawConfig = env.llmProviders[provider] || env.llmProviders['qwen'];

  if (!rawConfig) {
    throw new Error(
      `LLM provider "${provider}" is not configured and "qwen" configuration is also missing. ` +
        `Available providers: ${Object.keys(env.llmProviders).join(', ')}`,
    );
  }

  // Clone config to avoid polluting global state when overriding model
  const config = { ...rawConfig };
  if (targetModel) {
    config.model = targetModel;
  }

  // Use the requested factory, or fallback to qwen
  const factory = providerFactories[provider] || providerFactories.qwen;
  const args = { userId, orgId, appId, runName, taskId, enable_thinking, enable_search, jsonMode, temperature };
  console.log('[createLLM] Initializing provider:', provider, 'with model:', config.model);
  
  return factory(config, args);
}
