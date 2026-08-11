import axios from 'axios';

/**
 * DingTalk Message Push V2 Handler (Proactive Push)
 * Uses standard robot v1.0 messaging APIs for both 1:1 (batchSend) and group (groupMessages/send).
 */
export async function handler(params, ctx) {
  const {
    clientId,
    clientSecret,
    robotCode,
    targetType,
    targetId,
    queryWord,
    msgType,
    content,
    title,
  } = params;

  console.info(
    `[DingTalk Message Push V2] Delivering message to ${targetId || queryWord} (${msgType}, ${targetType})...`,
  );

  try {
    // 1. Get AccessToken (Standard OAuth with Caching)
    const token = await getAccessToken(clientId, clientSecret, ctx);

    // 2. Identify target type (Group or Individual)
    const isGroup = targetType === 'GROUP' || targetId?.startsWith('cid');

    // 3. Resolve Target ID (If OTO and ID is missing, search by queryWord)
    let finalTargetId = targetId;
    if (!isGroup && !finalTargetId && queryWord) {
      console.info(`[DingTalk Push] Searching UserID for: ${queryWord}`);
      const userList = await searchUserId(token, queryWord);
      if (userList.length === 0) {
        throw new Error(`找不到用户: ${queryWord}`);
      }
      if (userList.length > 1) {
        throw new Error(`搜索到多个匹配用户(${queryWord})，请提供更精确的关键词或 UserID`);
      }
      finalTargetId = userList[0];
      console.info(`[DingTalk Push] Found UserID: ${finalTargetId}`);
    }

    if (!finalTargetId) {
      throw new Error('未提供推送目标 ID 或搜索关键词');
    }

    // Normalize targetId if it's already a spaceId/openSpaceId
    let normalizedTargetId = finalTargetId;
    if (targetType === 'IM_GROUP' || isGroup) {
      if (finalTargetId?.includes('.')) {
        normalizedTargetId = finalTargetId.split('.').pop(); // Get CID after the dot
      }
    }

    // 4. Select appropriate API endpoint and payload structure
    // Person-to-person (1:1): oToMessages/batchSend
    // Group: groupMessages/send
    const url = isGroup
      ? 'https://api.dingtalk.com/v1.0/robot/groupMessages/send'
      : 'https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend';

    // 4. Construct msgParam (JSON String)
    const msgParamObj =
      msgType === 'markdown' ? { title: title || '通知', text: content } : { content: content };

    const payload = {
      robotCode: robotCode || clientId,
      msgKey: msgType === 'markdown' ? 'sampleMarkdown' : 'sampleText',
      msgParam: JSON.stringify(msgParamObj),
    };

    if (isGroup) {
      payload.openConversationId = normalizedTargetId;
    } else {
      payload.userIds = [normalizedTargetId];
    }

    // 5. Execute Request
    console.debug(`[DingTalk Push] Final URL: ${url}`);

    const res = await axios.post(url, payload, {
      headers: {
        'x-acs-dingtalk-access-token': token,
        'Content-Type': 'application/json',
      },
    });

    console.info(`[DingTalk Push] Delivery Result: ${JSON.stringify(res.data, null, 2)}`);

    return {
      success: true,
      result: res.data,
    };
  } catch (err) {
    const errorMsg = err.response?.data || err.message;
    console.error(`[DingTalk Push] Delivery Failed: ${err.message}`, errorMsg);

    return {
      success: false,
      error: errorMsg,
    };
  }
}

// --- Helpers ---

/**
 * Get AccessToken with persistent caching in User Properties
 */
async function getAccessToken(clientId, clientSecret, ctx) {
  const cacheKey = `dt_accessToken_${clientId}`;
  const now = Date.now();

  try {
    // 1. Try to hit persistent cache
    const cached = await ctx.userProperties.get(cacheKey);

    if (cached && cached.token && cached.expiresAt > now + 300000) {
      // Buffer of 5 minutes before real expiration
      console.debug(`[DingTalk] Using cached token for clientId: ${clientId}`);
      return cached.token;
    }

    // 2. Fetch from DingTalk API
    console.info(`[DingTalk] Fetching fresh token for clientId: ${clientId}...`);
    const res = await axios.post('https://api.dingtalk.com/v1.0/oauth2/accessToken', {
      appKey: clientId,
      appSecret: clientSecret,
    });

    const { accessToken, expireIn } = res.data;
    if (!accessToken) throw new Error(' DingTalk API returned empty token');

    // 3. Persist to cache (expireIn is in seconds)
    const expiresAt = now + expireIn * 1000;
    await ctx.userProperties.set(
      cacheKey,
      {
        token: accessToken,
        expiresAt: expiresAt,
      },
      'overwrite',
    );

    return accessToken;
  } catch (err) {
    const errorMsg = err.response?.data || err.message;
    console.error('[DingTalk] Get AccessToken Failed:', errorMsg);
    throw err;
  }
}

/**
 * Search for UserID using Keyword (Name, Pinyin, or Mobile)
 */
async function searchUserId(token, queryWord) {
  try {
    const res = await axios.post(
      'https://api.dingtalk.com/v1.0/contact/users/search',
      {
        queryWord: queryWord,
        offset: 0,
        size: 2, // Request 2 to check for multiple results
        fullMatchField: 1,
      },
      {
        headers: {
          'x-acs-dingtalk-access-token': token,
          'Content-Type': 'application/json',
        },
      },
    );

    return res.data.list || [];
  } catch (err) {
    console.error('[DingTalk] Search UserID Failed:', err.response?.data || err.message);
    throw new Error('搜索用户信息失败，请检查通讯录权限');
  }
}
