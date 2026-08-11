import asyncHandler from 'express-async-handler';
import GatewayChannelRepository from '../repositories/gatewayChannel.repository.js';
import gatewayBus from '../services/eventBus.js';
import { sendSuccess } from '../utils/response.js';
import ApiError from '../utils/ApiError.js';

/**
 * 通过消息总线向 Gateway 进程发送渠道控制命令
 * Gateway 进程 subscribe gateway_command，收到后执行实际的 start/stop 操作
 */
async function notifyGateway(action, channelId) {
  await gatewayBus.publish('gateway_command', { action, channelId });
}

/**
 * Get all channels for an app/org
 */
export const getChannels = asyncHandler(async (req, res) => {
  const { appId } = req.query;
  const filter = {};
  if (appId) filter.appId = appId;

  const organizationId = req.headers['x-organization-id'];
  const channels = await GatewayChannelRepository.findAll();

  const filtered = channels.filter((c) => {
    const orgMatch = !organizationId || c.organizationId === organizationId;
    const appMatch = !appId || c.appId === appId;
    return orgMatch && appMatch;
  });

  sendSuccess(res, filtered);
});

/**
 * Create a new channel
 */
export const createChannel = asyncHandler(async (req, res) => {
  const organizationId = req.headers['x-organization-id'];

  const channel = await GatewayChannelRepository.create({
    ...req.body,
    organizationId,
  });

  // If active, notify Gateway process to start the channel
  if (channel.status === 'ACTIVE') {
    await notifyGateway('start', channel.id);
  }

  sendSuccess(res, channel);
});

/**
 * Update a channel
 */
export const updateChannel = asyncHandler(async (req, res) => {
  const id = req.body.id || req.params.id;
  if (!id) throw ApiError.badRequest('Channel ID is required');

  const updated = await GatewayChannelRepository.update(id, req.body);

  // 通过 NOTIFY 通知 Gateway 进程刷新连接
  if (req.body.status === 'INACTIVE') {
    await notifyGateway('stop', id);
  } else if (req.body.status === 'ACTIVE') {
    // 先停再启，确保干净重启
    await notifyGateway('stop', id);
    await notifyGateway('start', id);
  }

  sendSuccess(res, updated);
});

/**
 * Delete a channel
 */
export const deleteChannel = asyncHandler(async (req, res) => {
  const id = req.body.id || req.params.id;
  if (!id) throw ApiError.badRequest('Channel ID is required');

  await notifyGateway('stop', id);
  await GatewayChannelRepository.delete(id);
  sendSuccess(res, { message: 'Channel deleted' });
});

/**
 * Check connection status
 * 注意：拆分 Gateway 后，API 进程无法直接检查 Provider 运行时连接状态，
 * 这里返回数据库中的渠道状态作为近似判断。
 */
export const testConnection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const channel = await GatewayChannelRepository.findById(id);
  if (!channel) throw ApiError.notFound('Channel not found');

  sendSuccess(res, { connected: channel.status === 'ACTIVE' });
});

export default {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  testConnection,
};
