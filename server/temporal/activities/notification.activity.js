import { logger } from '../../config/logger.js';
import crypto from 'crypto';

export const handleNotification = async (data, nodeId, workflowId) => {
  const { title, content, type = 'INTERNAL' } = data;
  logger.info({ title, type }, 'Temporal Activity: Sending notification');
  return { success: true, sentAt: new Date() };
};

export const handleDingTalkRobot = async (data, nodeId, workflowId) => {
  let { webhook, secret, msgType = 'text', title, content } = data;

  webhook = webhook?.trim();
  secret = secret?.trim();

  if (!webhook) throw new Error('DingTalk Webhook URL is required');
  if (!content) throw new Error('Message content is required');

  let targetUrl = webhook;

  if (secret) {
    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${secret}`;
    const sign = crypto
      .createHmac('sha256', Buffer.from(secret, 'utf8'))
      .update(Buffer.from(stringToSign, 'utf8'))
      .digest('base64');
    const encodedSign = encodeURIComponent(sign);

    const urlObj = new URL(targetUrl);
    urlObj.searchParams.set('timestamp', timestamp);
    urlObj.searchParams.set('sign', encodedSign);
    targetUrl = urlObj.toString();
  }

  let payload = {};
  if (msgType === 'markdown') {
    payload = {
      msgtype: 'markdown',
      markdown: { title: title || 'Notification', text: content },
    };
  } else {
    payload = {
      msgtype: 'text',
      text: { content: content },
    };
  }

  const { atAll, atMobiles, atUserIds } = data;
  const atObj = {};
  if (atAll === true) atObj.isAtAll = true;
  if (atMobiles) {
    atObj.atMobiles = String(atMobiles)
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
  }
  if (atUserIds) {
    atObj.atUserIds = String(atUserIds)
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
  }
  if (Object.keys(atObj).length > 0) payload.at = atObj;

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const responseData = await response.json();
  if (responseData.errcode !== 0) {
    throw new Error(`DingTalk Error: ${responseData.errmsg} (${responseData.errcode})`);
  }

  return responseData;
};
