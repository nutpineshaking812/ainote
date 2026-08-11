import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import TokenUsageRepository from '../../repositories/tokenUsage.repository.js';
import QuotaRepository from '../../repositories/quota.repository.js';
import ApplicationRepository from '../../repositories/application.repository.js';
import OrganizationMemberRepository from '../../repositories/organizationMember.repository.js';

/**
 * Custom LangChain Callback Handler to track token usage
 */
export class TokenUsageCallbackHandler extends BaseCallbackHandler {
  name = 'token_usage_callback_handler';

  constructor({ userId, orgId, modelName, appId, runName, taskId }) {
    super();
    this.userId = userId;
    this.orgId = orgId;
    this.modelName = modelName;
    this.appId = appId;
    this.runName = runName;
    this.taskId = taskId;
  }


  /**
   * Called when LLM ends running.
   */
  async handleLLMEnd(output) {
    try {
      const usage = output.llmOutput?.tokenUsage || output.usage_metadata;

      if (usage && (usage.promptTokens || usage.prompt_tokens)) {
        const promptTokens = usage.promptTokens || usage.prompt_tokens || 0;
        const completionTokens = usage.completionTokens || usage.completion_tokens || 0;

        await recordTokenUsage({
          userId: this.userId,
          orgId: this.orgId,
          appId: this.appId,
          model: this.modelName,
          promptTokens,
          completionTokens,
          runName: this.runName,
          taskId: this.taskId,
        });
      }
    } catch (error) {
      console.error('[TokenTracker] Error recording token usage:', error);
    }
  }
}

/**
 * Helper to resolve the correct Organization ID
 */
async function resolveOrganizationId(userId, orgId, appId) {
  if (orgId) return orgId;
  
  if (appId) {
    const app = await ApplicationRepository.findById(appId);
    if (app) return app.organizationId.toString();
  }

  const memberships = await OrganizationMemberRepository.findByUserId(userId);
  const activeMember = memberships.find(m => m.status === 'ACTIVE');
  return activeMember?.organizationId;
}

/**
 * Standalone function to record usage if not using LangChain
 */
export async function recordTokenUsage({
  userId,
  orgId,
  appId,
  model,
  promptTokens,
  completionTokens,
  runName,
  taskId,
}) {
  try {
    if (!userId) {
      console.warn('[TokenTracker] Skip recording: Invalid or missing userId:', userId);
      return;
    }

    const totalTokens = (promptTokens || 0) + (completionTokens || 0);
    const finalOrgId = await resolveOrganizationId(userId, orgId, appId);

    const data = {
      userId,
      organizationId: finalOrgId,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      runName,
      taskId,
    };

    if (appId) {
      data.appId = appId;
    }

    await TokenUsageRepository.create(data);

    if (finalOrgId) {
      await QuotaRepository.incrementUsage(finalOrgId, totalTokens);
    }

    await QuotaRepository.incrementTotalUsage(userId, totalTokens);
  } catch (error) {
    console.error('[TokenTracker] Manual record error:', error);
  }
}

/**
 * Check if user and organization have sufficient tokens/quota
 */
export async function checkTokenBalance(userId, orgId, appId) {
  if (!userId) return;

  try {
    const userQuota = await QuotaRepository.findOne('USER', userId);
    if (userQuota && userQuota.usageLimit !== -1 && userQuota.totalTokenUsage >= userQuota.usageLimit) {
      throw new Error(`Personal AI usage limit exceeded (${userQuota.totalTokenUsage}/${userQuota.usageLimit})`);
    }

    const finalOrgId = await resolveOrganizationId(userId, orgId, appId);
    if (finalOrgId) {
      const orgQuota = await QuotaRepository.findOne('ORG', finalOrgId);
      if (orgQuota && orgQuota.tokenBalance <= 0) {
        throw new Error(`Organization AI token balance exhausted (Balance: ${orgQuota.tokenBalance})`);
      }
    }
  } catch (error) {
    console.error('[TokenTracker] Token check failed:', error);
    throw error;
  }
}
