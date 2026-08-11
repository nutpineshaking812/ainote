import axios from 'axios';
import crypto from 'crypto';
import { DWClient, EventAck, TOPIC_ROBOT, TOPIC_CARD } from 'dingtalk-stream';

/**
 * 钉钉插件 (安全重构版) - 基于受控上下文实现连接、监听、触发和反馈
 * 支持热更新 (Hot Reload)
 */

const clients = new Map(); // Key: clientId
const activeExecutions = new Map(); // Key: executionId
let pluginContext = null;

/**
 * 插件激活钩子：在此处建立与钉钉的 Stream 连接
 */
export async function onActivate(ctx) {
  pluginContext = ctx;
  const { logger, eventBus, getActiveWorkflows } = ctx;

  logger.info('DingTalk Plugin V2: Starting activation and scanning workflows...');

  try {
    // 🛡️ 安全化改造：使用系统提供的受控接口获取活跃工作流，而不直接接触 models
    const workflows = await getActiveWorkflows();

    const configs = new Map();
    for (const wf of workflows) {
      // 获取该工作流下所有匹配该插件的节点
      const pluginNodes = wf.nodes.filter((n) => n.data?.pluginId === ctx.pluginId);

      for (const node of pluginNodes) {
        const params = node.data?.pluginParams || {};
        const { clientId, clientSecret, templateId } = params;

        if (clientId && clientSecret) {
          if (!configs.has(clientId)) {
            configs.set(clientId, { clientSecret, templateId, workflows: [], nodeIds: [] });
          }
          const cfg = configs.get(clientId);
          cfg.nodeIds.push(node.id);
          cfg.workflows.push({
            id: wf.workflowKey || wf._id.toString(),
            templateId,
          });
        }
      }
    }

    for (const [clientId, config] of configs.entries()) {
      await startDingTalkClient(clientId, config);
    }
  } catch (err) {
    logger.error({ err }, 'Failed to scan workflows for plugin triggers');
  }

  // 绑定进度总线 (使用封装过的 eventBus) - 绑定前先解绑，防止多次重载导致事件重复绑定和资源泄露
  eventBus.off('node:progress', onNodeProgress);
  eventBus.off('workflow:success', onWorkflowSuccess);
  eventBus.off('workflow:error', onWorkflowError);

  eventBus.on('node:progress', onNodeProgress);
  eventBus.on('workflow:success', onWorkflowSuccess);
  eventBus.on('workflow:error', onWorkflowError);
}

/**
 * 插件停用钩子
 */
export async function onDeactivate(ctx) {
  const { logger, eventBus } = ctx;
  logger.info('DingTalk Plugin V2: Deactivating and closing connections...');

  for (const [clientId, client] of clients.entries()) {
    try {
      await client.disconnect();
    } catch (e) {
      logger.warn(`Error closing client ${clientId}: ${e.message}`);
    }
  }
  clients.clear();
  activeExecutions.clear();
  ctx.updateStatus({ connected: false });

  eventBus.off('node:progress', onNodeProgress);
  eventBus.off('workflow:success', onWorkflowSuccess);
  eventBus.off('workflow:error', onWorkflowError);
}

function scheduleFlush(executionCtx) {
  if (executionCtx.flushTimer) return;
  if (executionCtx.isFlushing) return;

  executionCtx.flushTimer = setTimeout(async () => {
    executionCtx.flushTimer = null;

    // 如果工作流已结束，立即跳出，防止旧的增量包覆盖最终的全量包
    if (executionCtx.terminated) return;
    if (!executionCtx.deltaBuffer) return;

    executionCtx.isFlushing = true;
    const delta = executionCtx.deltaBuffer;
    executionCtx.deltaBuffer = '';

    try {
      // console.log('updateCard', executionCtx.outTrackId, delta);
      await updateCard(executionCtx, false, delta);
    } catch (err) {
      console.error(
        '[DingTalk V2] updateCard throttled flush error:',
        err.response?.data || err.message,
      );
    } finally {
      executionCtx.isFlushing = false;
      if (executionCtx.deltaBuffer) {
        scheduleFlush(executionCtx);
      }
    }
  }, 400); // 400ms flush interval
}

async function onNodeProgress(data) {
  const { executionId, status, content } = data;
  const executionCtx = activeExecutions.get(String(executionId));
  if (!executionCtx) return;

  let delta = content || '';
  if (!delta) return;

  if (status === 'thinking-delta') {
    let cleanDelta = delta;

    // 如果是第一条 thinking
    if (!executionCtx.thinking) {
      cleanDelta = '> 思考中...  \n> ' + cleanDelta.replace(/\n/g, '  \n> ');
    } else {
      cleanDelta = cleanDelta.replace(/\n/g, '  \n> ');
    }

    executionCtx.thinking = (executionCtx.thinking || '') + content;

    if (cleanDelta) {
      executionCtx.deltaBuffer = (executionCtx.deltaBuffer || '') + cleanDelta;
      scheduleFlush(executionCtx);
    }
  } else if (status === 'text-delta') {
    // 如果之前有思考，并且这是第一条 text-delta，我们需要跳出引用
    if (executionCtx.thinking && !executionCtx.text) {
      delta = '\n\n' + delta;
    }
    executionCtx.text = (executionCtx.text || '') + content;

    executionCtx.deltaBuffer = (executionCtx.deltaBuffer || '') + delta;
    scheduleFlush(executionCtx);
  }
}

async function onWorkflowSuccess(data) {
  const executionIdStr = String(data.executionId);
  const executionCtx = activeExecutions.get(executionIdStr);
  console.log('onWorkflowSuccess', executionIdStr, !!executionCtx);
  if (executionCtx) {
    try {
      executionCtx.terminated = true; // 立即标记终止，关停所有异步 flush
      if (executionCtx.flushTimer) clearTimeout(executionCtx.flushTimer);
      executionCtx.flushTimer = null;
      await updateCard(executionCtx, true);
    } catch (err) {
      console.error('[DingTalk V2] Final success update failed:', err.message);
    } finally {
      activeExecutions.delete(executionIdStr);
    }
  }
}

async function onWorkflowError(data) {
  const executionIdStr = String(data.executionId);
  const executionCtx = activeExecutions.get(executionIdStr);
  console.log('onWorkflowError', executionIdStr, !!executionCtx);
  if (executionCtx) {
    try {
      executionCtx.terminated = true; // 立即标记终止
      if (executionCtx.flushTimer) clearTimeout(executionCtx.flushTimer);
      executionCtx.flushTimer = null;
      executionCtx.text += `\n\n> ❌ 出错: ${data.error}`;
      await updateCard(executionCtx, true);
    } catch (err) {
      console.error('[DingTalk V2] Final error update failed:', err.message);
    } finally {
      activeExecutions.delete(executionIdStr);
    }
  }
}

/**
 * 启动钉钉 Stream 客户端
 */
async function startDingTalkClient(clientId, config) {
  const { clientSecret, workflows } = config;
  const { logger, triggerWorkflow, terminateWorkflow } = pluginContext;

  if (clients.has(clientId)) return;

  const client = new DWClient({ clientId, clientSecret });

  client.registerCallbackListener(TOPIC_ROBOT, async (res) => {
    const data = JSON.parse(res.data);
    // const question = (data.text?.content || '').trim();
    let question = '';
    if (data.msgtype == 'text') {
      question = (data.text?.content || '').trim();
    } else if (data.msgtype == 'audio') {
      question = (data.content?.recognition || '').trim();
    } else {
      question = '';
    }

    const target = workflows[0];
    if (!target) {
      logger.error('No workflow configured for this robot');
      client.socketCallBackResponse(res.headers.messageId, EventAck.FAILURE);
      return;
    }

    logger.info(
      { msgId: res.headers.messageId, workflowId: target.id },
      `Received message: ${question}`,
    );

    // 3. 触发工作流（支持基于会话的并发抑制）
    const businessId = `robot-session-${data.conversationId}`;
    await terminateWorkflow(businessId);

    // 1. Get AccessToken (Standard OAuth with Caching)
    const token = await getAccessToken(clientId, clientSecret, pluginContext);

    // 2. 创建并投递卡片底座
    const outTrackId = `card_${data.msgId}_${crypto.randomUUID().substring(0, 8)}`;
    const cardResult = await createCard(clientId, token, data, outTrackId, target.templateId);

    if (!cardResult) {
      logger.error({ msgId: res.headers.messageId }, 'Failed to create dingtalk card');
      client.socketCallBackResponse(res.headers.messageId, EventAck.FAILURE);
      return;
    }

    const { executionId } = await triggerWorkflow(
      target.id,
      {
        query: question,
        senderId: data.senderId,
        senderNick: data.senderNick,
        conversationId: data.conversationId,
        source: 'plugin-dingtalk-v2',
        dingtalkContext: {
          outTrackId: outTrackId,
          templateId: target.templateId,
          message: data,
        },
      },
      { deterministicId: businessId },
    );

    // 4. 注册执行记录
    activeExecutions.set(String(executionId), {
      clientId,
      clientSecret,
      outTrackId: outTrackId,
      templateId: target.templateId,
      thinking: '',
      text: '',
      accessToken: token,
      deltaBuffer: '',
      isFlushing: false,
      flushTimer: null,
    });

    client.socketCallBackResponse(res.headers.messageId, EventAck.SUCCESS);
  });

  client.registerCallbackListener(TOPIC_CARD, (e) =>
    client.socketCallBackResponse(e.headers.messageId, EventAck.SUCCESS),
  );

  try {
    await client.connect();
    clients.set(clientId, client);
    logger.info(`DingTalk Client connected: ${clientId}`);

    // 给该 clientId 下的所有节点上报“已连接”
    if (config.nodeIds) {
      config.nodeIds.forEach((nodeId) => {
        pluginContext.updateStatus(nodeId, {
          connected: true,
          text: '已连接',
          detail: `Client: ${clientId}`,
        });
      });
    }
  } catch (err) {
    logger.error({ err }, `Failed to connect DingTalk client: ${clientId}`);
    // 给该 clientId 下的所有节点上报“连接失败”
    if (config.nodeIds) {
      config.nodeIds.forEach((nodeId) => {
        pluginContext.updateStatus(nodeId, {
          connected: false,
          text: '连接失败',
          error: err.message,
        });
      });
    }
  }
}

/**
 * Node Handler
 */
export async function handler(params, ctx) {
  const { clientId, clientSecret, templateId, content } = params;
  const { executionId, triggerData } = ctx;

  const token = await getAccessToken(clientId, clientSecret, ctx);
  const dtCtx = triggerData?.dingtalkContext;

  if (dtCtx) {
    activeExecutions.set(String(executionId), {
      clientId,
      clientSecret,
      outTrackId: dtCtx.outTrackId,
      templateId: templateId || dtCtx.templateId,
      accessToken: token,
      thinking: '',
      text: content || '',
      deltaBuffer: '',
      isFlushing: false,
      flushTimer: null,
    });

    return {
      ...triggerData,
      success: true,
      mode: 'hooked',
    };
  }

  return { 
    ...triggerData, 
    success: true, 
    info: 'Active push or bypass' 
  };
}

// --- Helpers ---

/**
 * Get AccessToken with persistent caching
 */
async function getAccessToken(clientId, clientSecret, ctx) {
  if (!ctx || !ctx.userProperties) {
    // Fail-safe for weird edge cases or unit tests
    const res = await axios.post('https://api.dingtalk.com/v1.0/oauth2/accessToken', {
      appKey: clientId,
      appSecret: clientSecret,
    });
    return res.data.accessToken;
  }

  const cacheKey = `dt_accessToken_${clientId}`;
  const now = Date.now();

  try {
    // 1. Try persistent cache
    const cached = await ctx.userProperties.get(cacheKey);
    if (cached && cached.token && cached.expiresAt > now + 300000) {
      console.debug(`[Robot V2] Using cached token for clientId: ${clientId}`);
      return cached.token;
    }

    // 2. Refresh from DingTalk
    console.info(`[Robot V2] Refreshing token for clientId: ${clientId}...`);
    const res = await axios.post('https://api.dingtalk.com/v1.0/oauth2/accessToken', {
      appKey: clientId,
      appSecret: clientSecret,
    });

    const { accessToken, expireIn } = res.data;
    const expiresAt = now + expireIn * 1000;

    // 3. Store (Note: userId would be 'SYSTEM' during onActivate and current userId during handler)
    await ctx.userProperties.set(cacheKey, { token: accessToken, expiresAt }, 'overwrite');

    return accessToken;
  } catch (err) {
    const errorMsg = err.response?.data || err.message;
    console.error('[Robot V2] Get AccessToken Failed:', errorMsg);
    throw err;
  }
}

/**
 * 创建并投递卡片
 */
async function createCard(clientId, token, message, outTrackId, templateId) {
  if (!templateId) return null;

  const payload = {
    cardTemplateId: templateId,
    outTrackId: outTrackId,
    cardData: { cardParamMap: { content: '思考中...' } },
    callbackType: 'STREAM',
    userIdType: 1,
    imGroupOpenSpaceModel: { supportForward: true },
    imRobotOpenSpaceModel: { supportForward: true },
  };

  // 根据单聊或群聊设置空间 ID
  if (message.conversationType === '2') {
    payload.openSpaceId = `dtv1.card//IM_GROUP.${message.conversationId}`;
    payload.imGroupOpenDeliverModel = { robotCode: clientId };
  } else {
    // 优先使用 senderStaffId
    const userId = message.senderStaffId || message.senderId;
    payload.openSpaceId = `dtv1.card//IM_ROBOT.${userId}`;
    payload.imRobotOpenDeliverModel = { spaceType: 'IM_ROBOT' };
  }

  try {
    const res = await axios.post(
      'https://api.dingtalk.com/v1.0/card/instances/createAndDeliver',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-acs-dingtalk-access-token': token,
        },
      },
    );
    return res.data.success ? res.data : null;
  } catch (err) {
    console.error('[DingTalk V2] Create Card Failed:', err.response?.data || err.message);
    return null;
  }
}

async function updateCard(context, isFinal, delta) {
  const { accessToken, outTrackId, thinking, text, terminated } = context;
  if (!outTrackId) return;

  // 如果已经终止且这只是一个普通增量包，则丢弃。
  // 除非 isFinal 为 true（因为它本身就是终止动作）。
  if (terminated && !isFinal) return;

  // 如果 delta 是 undefined，说明是全量更新（通常用于最终收尾）
  const isFull = delta === undefined;

  let display = '';
  if (isFull) {
    if (thinking) {
      const cleanThinking = thinking.replace(/<\/?think>/g, '').trim();
      if (cleanThinking) {
        display += `> 思考中...  \n> ${cleanThinking.replace(/\n/g, '  \n> ')}\n\n`;
      }
    }
    display += text || '';
  } else {
    display = delta;
  }

  try {
    // 修复：移除导致 ReferenceError 的未定义变量 content 和 guid
    // console.log('[DingTalk V2] updateCard:', { outTrackId, isFull, isFinal, length: display?.length });

    await axios.put(
      'https://api.dingtalk.com/v1.0/card/streaming',
      {
        outTrackId,
        guid: crypto.randomUUID(),
        key: 'content',
        content: display,
        isFull: isFull,
        isFinalize: isFinal,
      },
      {
        headers: { 'x-acs-dingtalk-access-token': accessToken },
      },
    );
  } catch (err) {
    console.error('[DingTalk V2] Update Card Failed:', err.response?.data || err.message);
  }
}
