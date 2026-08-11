import { spawn } from 'child_process';
import axios from 'axios';
import McpServerRepository from '../repositories/mcpServer.repository.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * McpService
 * Manages the lifecycle and execution of Model Context Protocol (MCP) servers.
 */
class McpService {
  /**
   * Install a new MCP Server configuration
   */
  async installServer(data) {
    const { name, label, type, stdioConfig, httpConfig, organizationId, createdBy } = data;

    // Check if server with same name exists
    const existing = await McpServerRepository.findByName(name);
    if (existing) {
      throw ApiError.badRequest(`MCP Server with name '${name}' already exists.`);
    }

    const mcpServer = await McpServerRepository.create({
      name,
      label: label || name,
      type: type || 'stdio',
      stdioConfig,
      httpConfig,
      organizationId,
      createdBy,
      status: 'INSTALLING', // Set to installing state
    });

    // Start discovery in background
    this.refreshDiscovery(mcpServer.id).catch((error) => {
      logger.error(
        { mcpId: mcpServer.id, error: error.message },
        'Background MCP discovery failed after installation',
      );
    });

    return mcpServer;
  }

  /**
   * Refresh the list of tools, resources, and prompts from the MCP server
   */
  async refreshDiscovery(serverId) {
    const server = await McpServerRepository.findById(serverId);
    if (!server) throw ApiError.notFound('MCP Server not found');

    logger.info({ mcpName: server.name }, 'Refreshing MCP discovery...');

    try {
      let tools = [];
      // let resources = [];
      // let prompts = [];

      if (server.type === 'stdio') {
        const response = await this._callStdio(server, 'tools/list', {});
        tools = response.tools || [];
      } else if (server.type === 'http') {
        const response = await this._callHttp(server, 'tools/list', {});
        tools = response.tools || [];
      }

      const updatedTools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));

      const runtime = {
        ...server.runtime,
        status: 'CONNECTED',
        lastConnectedAt: new Date(),
        lastError: null,
      };

      return await McpServerRepository.update(serverId, {
        tools: updatedTools,
        runtime,
        status: 'ACTIVE',
      });
    } catch (error) {
      const runtime = {
        ...server.runtime,
        status: 'ERROR',
        lastError: error.message,
      };
      await McpServerRepository.update(serverId, { runtime });
      throw error;
    }
  }

  /**
   * Call a tool on an MCP server
   */
  async callTool(serverId, toolName, args) {
    const server = await McpServerRepository.findById(serverId);
    if (!server) throw ApiError.notFound('MCP Server not found');

    logger.info({ mcpName: server.name, toolName }, 'Calling MCP tool...');

    if (server.type === 'stdio') {
      return await this._callStdio(server, 'tools/call', {
        name: toolName,
        arguments: args,
      });
    } else {
      return await this._callHttp(server, 'tools/call', {
        name: toolName,
        arguments: args,
      });
    }
  }

  constructor() {
    // Cache for active stdio connections: serverId -> { child, pendingRequests, stdoutBuffer }
    this.connections = new Map();
  }

  /**
   * Internal: Call MCP over Stdio (Persistent Process Pool)
   */
  async _callStdio(server, method, params) {
    const serverId = server.id;
    const client = await this._getOrCreateClient(server);
    const requestId = Date.now() + Math.floor(Math.random() * 1000);

    return new Promise((resolve, reject) => {
      // 1. Register the pending request
      client.pendingRequests.set(requestId, { resolve, reject });

      // 2. Prepare request
      const request =
        JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          method,
          params,
        }) + '\n';

      // 3. Send to stdin
      try {
        client.child.stdin.write(request);
      } catch (err) {
        client.pendingRequests.delete(requestId);
        this._cleanupClient(serverId);
        return reject(new Error(`Failed to write to MCP stdin: ${err.message}`));
      }

      // 4. Set safety timeout
      setTimeout(() => {
        const handler = client.pendingRequests.get(requestId);
        if (handler) {
          client.pendingRequests.delete(requestId);
          handler.reject(new Error(`MCP Request '${method}' (id: ${requestId}) timed out`));
        }
      }, 60000);
    });
  }

  /**
   * Get an existing client or create a new one for a server
   */
  async _getOrCreateClient(server) {
    const serverId = server.id;
    let client = this.connections.get(serverId);

    if (client && !client.child.killed) {
      return client;
    }

    // Initialize new client
    logger.info({ mcpName: server.name }, 'Spawning new persistent MCP process...');
    const { command, args, env } = server.stdioConfig;
    const cleanEnv = typeof env === 'object' ? env : {};

    const child = spawn(command, args, {
      env: { ...process.env, ...cleanEnv },
      shell: true,
    });

    client = {
      child,
      pendingRequests: new Map(), // requestId -> { resolve, reject }
      stdoutBuffer: '',
    };

    this.connections.set(serverId, client);

    // Setup Output Handlers
    child.stdout.on('data', (data) => {
      client.stdoutBuffer += data.toString();
      this._processStdoutLines(serverId);
    });

    child.stderr.on('data', (data) => {
      logger.warn({ mcpName: server.name, stderr: data.toString() }, 'MCP Side-Log');
    });

    child.on('error', (err) => {
      logger.error({ mcpName: server.name, err }, 'MCP Process Error');
      this._cleanupClient(serverId, err);
    });

    child.on('close', (code) => {
      logger.info({ mcpName: server.name, code }, 'MCP Process Closed');
      this._cleanupClient(serverId, new Error(`Process closed with code ${code}`));
    });

    return client;
  }

  /**
   * Process cumulative stdout lines to find complete JSON-RPC messages
   */
  _processStdoutLines(serverId) {
    const client = this.connections.get(serverId);
    if (!client) return;

    const lines = client.stdoutBuffer.split('\n');
    client.stdoutBuffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line);
        if (response.id !== undefined) {
          const handler = client.pendingRequests.get(response.id);
          if (handler) {
            client.pendingRequests.delete(response.id);
            if (response.error) {
              handler.reject(new ApiError(400, response.error.message || 'MCP Remote Error'));
            } else {
              handler.resolve(response.result);
            }
          }
        }
      } catch (e) {
        // Ignored
      }
    }
  }

  /**
   * Helper to cleanup and reject all pending requests
   */
  _cleanupClient(serverId, error) {
    const client = this.connections.get(serverId);
    if (client) {
      for (const [id, handler] of client.pendingRequests) {
        handler.reject(error || new Error('MCP Connection Closed'));
      }
      if (!client.child.killed) client.child.kill();
      this.connections.delete(serverId);
    }
  }

  /**
   * Internal: Call MCP over HTTP (Streamable)
   */
  async _callHttp(server, method, params) {
    const { url, headers } = server.httpConfig;
    const requestId = Date.now();

    try {
      const response = await axios.post(
        url,
        {
          jsonrpc: '2.0',
          id: requestId,
          method,
          params,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(headers || {}),
            ...(server.runtime.sessionId ? { 'Mcp-Session-Id': server.runtime.sessionId } : {}),
          },
        },
      );

      // Handle Session ID updates from headers if provided (Streamable pattern)
      if (response.headers['mcp-session-id']) {
        const runtime = {
          ...server.runtime,
          sessionId: response.headers['mcp-session-id']
        };
        await McpServerRepository.update(server.id, { runtime });
      }

      if (response.data.error) {
        throw new Error(response.data.error.message || 'Unknown MCP HTTP error');
      }

      return response.data.result;
    } catch (error) {
      const message = error.response?.data?.error?.message || error.message;
      throw new Error(`MCP HTTP call failed: ${message}`);
    }
  }

  /**
   * Get all servers for an organization
   */
  async getServersByOrg(orgId) {
    return await McpServerRepository.findAll(orgId);
  }

  /**
   * Delete a server integration
   */
  async deleteServer(serverId) {
    return await McpServerRepository.delete(serverId);
  }
}

export default new McpService();
