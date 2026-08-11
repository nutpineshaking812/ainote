import crypto from 'crypto';
import { buildHistoryMessage } from '../utils/build_message.js';

export const buildGeneralSession = async (userId, appId, conversationId, docId, refs) => {
  // console.log('buildGeneralSession', { userId, appId, conversationId, docId, refs });
  const session = {
    refs: refs || [],
    docId,
    messages: [], // 消息历史
    appId,
    userId,
    taskId: crypto.randomUUID(),
  };
  session.messages = await buildHistoryMessage(conversationId);
  return session;
};
