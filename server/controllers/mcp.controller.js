import asyncHandler from 'express-async-handler';
import McpService from '../services/mcp.service.js';
import McpServerRepository from '../repositories/mcpServer.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

/**
 * MCP Controller
 */
export const installServer = asyncHandler(async (req, res) => {
  const { name, label, type, stdioConfig, httpConfig } = req.body;
  const organizationId = req.headers['x-organization-id'];

  if (!organizationId) {
    throw ApiError.badRequest('Missing Organization context (X-Organization-ID)');
  }

  const mcpServer = await McpService.installServer({
    name,
    label,
    type,
    stdioConfig,
    httpConfig,
    organizationId,
    createdBy: req.user.id,
  });

  return sendSuccess(res, mcpServer, 201);
});

export const getServers = asyncHandler(async (req, res) => {
  const { organizationId: queryOrgId } = req.query;
  const organizationId = queryOrgId || req.headers['x-organization-id'];

  const servers = await McpService.getServersByOrg(organizationId);

  return sendSuccess(res, servers);
});

export const refreshServer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const server = await McpService.refreshDiscovery(id);

  return sendSuccess(res, server);
});

export const deleteServer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await McpService.deleteServer(id);

  return sendSuccess(res, { message: 'MCP Server deleted successfully' });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const server = await McpServerRepository.update(id, { status });

  return sendSuccess(res, server);
});
