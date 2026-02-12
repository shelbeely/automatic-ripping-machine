/**
 * MCP Client — allows ARM to use external MCP tool servers.
 *
 * ARM acts as an MCP **client**, connecting to one or more MCP-compatible
 * tool servers (e.g., media databases, file organizers, notification
 * services, metadata providers) and calling their tools as part of the
 * ripping pipeline.
 *
 * Configuration is via the `MCP_APPS` array in arm.yaml or the
 * `ARM_MCP_APPS` environment variable (JSON array). Each entry specifies
 * a server to connect to:
 *
 *   MCP_APPS:
 *     - name: media-db
 *       command: npx
 *       args: ["-y", "@some/mcp-media-server"]
 *     - name: file-organizer
 *       url: http://localhost:3001/mcp
 *
 * @see https://modelcontextprotocol.io
 */
const { Client } = require('@modelcontextprotocol/sdk/client');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { createLogger } = require('../ripper/logger');

const logger = createLogger('mcp_client');

/**
 * Connected MCP app instances, keyed by name.
 * Each value is { client, transport, tools, name }.
 */
const connectedApps = new Map();

/**
 * Parse MCP app configurations from ARM config or environment.
 *
 * Returns an array of { name, command?, args?, url? } objects.
 */
function parseMcpAppsConfig(config) {
  // From config file
  if (config && Array.isArray(config.MCP_APPS) && config.MCP_APPS.length > 0) {
    return config.MCP_APPS;
  }

  // From environment variable (JSON)
  const envApps = process.env.ARM_MCP_APPS;
  if (envApps) {
    try {
      const parsed = JSON.parse(envApps);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      logger.warn(`Failed to parse ARM_MCP_APPS environment variable: ${err.message}`);
    }
  }

  return [];
}

/**
 * Connect to a single MCP app server via stdio transport.
 *
 * @param {object} appConfig - { name, command, args, env }
 * @returns {object|null} - { client, transport, tools, name } or null on failure
 */
async function connectStdioApp(appConfig) {
  const { name, command, args = [], env } = appConfig;
  if (!command) {
    logger.warn(`MCP app "${name}" has no command specified, skipping`);
    return null;
  }

  try {
    const transportOpts = { command, args };
    if (env && typeof env === 'object') {
      transportOpts.env = { ...process.env, ...env };
    }
    const transport = new StdioClientTransport(transportOpts);
    const client = new Client({ name: `arm-${name}`, version: '1.0.0' });
    await client.connect(transport);

    // Discover available tools
    const toolsResult = await client.listTools();
    const tools = toolsResult.tools || [];
    logger.info(`MCP app "${name}" connected — ${tools.length} tools available: ${tools.map((t) => t.name).join(', ')}`);

    return { client, transport, tools, name };
  } catch (err) {
    logger.warn(`Failed to connect MCP app "${name}": ${err.message}`);
    return null;
  }
}

/**
 * Initialize all configured MCP app connections.
 *
 * Call this once at startup. It connects to each configured MCP server
 * and discovers their available tools.
 */
async function initializeMcpApps(config) {
  const appConfigs = parseMcpAppsConfig(config);
  if (appConfigs.length === 0) {
    logger.debug('No MCP apps configured');
    return;
  }

  logger.info(`Initializing ${appConfigs.length} MCP app(s)...`);

  for (const appConfig of appConfigs) {
    if (!appConfig.name) {
      logger.warn('MCP app config missing "name" field, skipping');
      continue;
    }

    let connection = null;

    if (appConfig.command) {
      connection = await connectStdioApp(appConfig);
    } else if (appConfig.url) {
      // HTTP/SSE transport — use stdio transport as an alternative for now
      logger.warn(`MCP app "${appConfig.name}" uses URL transport (HTTP/SSE) which is not yet supported. Use "command" with stdio transport instead.`);
      continue;
    } else {
      logger.warn(`MCP app "${appConfig.name}" has no command or url, skipping`);
      continue;
    }

    if (connection) {
      connectedApps.set(appConfig.name, connection);
    }
  }

  logger.info(`${connectedApps.size} MCP app(s) connected`);
}

/**
 * Call a tool on a specific MCP app by name.
 *
 * @param {string} appName - Name of the MCP app to call
 * @param {string} toolName - Name of the tool to invoke
 * @param {object} args - Arguments to pass to the tool
 * @returns {object|null} - Tool result or null on failure
 */
async function callTool(appName, toolName, args = {}) {
  const app = connectedApps.get(appName);
  if (!app) {
    logger.warn(`MCP app "${appName}" not connected`);
    return null;
  }

  try {
    const result = await app.client.callTool({ name: toolName, arguments: args });
    logger.debug(`MCP tool call ${appName}/${toolName} succeeded`);
    return result;
  } catch (err) {
    logger.warn(`MCP tool call ${appName}/${toolName} failed: ${err.message}`);
    return null;
  }
}

/**
 * Find a tool across all connected MCP apps.
 * Returns { appName, tool } or null if not found.
 */
function findTool(toolName) {
  for (const [appName, app] of connectedApps) {
    const tool = app.tools.find((t) => t.name === toolName);
    if (tool) return { appName, tool };
  }
  return null;
}

/**
 * Call a tool by name, automatically finding which app provides it.
 *
 * @param {string} toolName - Name of the tool to call
 * @param {object} args - Arguments to pass
 * @returns {object|null} - Tool result or null
 */
async function callToolAuto(toolName, args = {}) {
  const found = findTool(toolName);
  if (!found) {
    logger.debug(`No MCP app provides tool "${toolName}"`);
    return null;
  }
  return callTool(found.appName, toolName, args);
}

/**
 * Get a list of all available tools across all connected MCP apps.
 * Includes _meta if present on the tool definition.
 */
function listAllTools() {
  const all = [];
  for (const [appName, app] of connectedApps) {
    for (const tool of app.tools) {
      const entry = { appName, name: tool.name, description: tool.description };
      if (tool._meta) entry._meta = tool._meta;
      all.push(entry);
    }
  }
  return all;
}

/**
 * List all resources across all connected MCP apps.
 * Returns an array of { appName, uri, name, description, mimeType }.
 */
async function listAllResources() {
  const all = [];
  for (const [appName, app] of connectedApps) {
    try {
      const result = await app.client.listResources();
      const resources = (result && result.resources) || [];
      for (const resource of resources) {
        all.push({
          appName,
          uri: resource.uri,
          name: resource.name || '',
          description: resource.description || '',
          mimeType: resource.mimeType || '',
        });
      }
    } catch (err) {
      logger.debug(`Could not list resources for MCP app "${appName}": ${err.message}`);
    }
  }
  return all;
}

/**
 * Read a resource from a specific MCP app.
 */
async function readResource(appName, uri) {
  const app = connectedApps.get(appName);
  if (!app) {
    logger.warn(`MCP app "${appName}" not connected`);
    return null;
  }

  try {
    const result = await app.client.readResource({ uri });
    return result;
  } catch (err) {
    logger.warn(`MCP resource read ${appName}/${uri} failed: ${err.message}`);
    return null;
  }
}

/**
 * Disconnect all MCP apps gracefully.
 */
async function disconnectAll() {
  for (const [name, app] of connectedApps) {
    try {
      await app.client.close();
      logger.debug(`MCP app "${name}" disconnected`);
    } catch (err) {
      logger.warn(`Error disconnecting MCP app "${name}": ${err.message}`);
    }
  }
  connectedApps.clear();
}

/**
 * Get the count of connected apps.
 */
function getConnectedCount() {
  return connectedApps.size;
}

/**
 * Check if any MCP apps are configured (even if not yet connected).
 */
function hasMcpAppsConfigured(config) {
  return parseMcpAppsConfig(config).length > 0;
}

module.exports = {
  parseMcpAppsConfig,
  initializeMcpApps,
  connectStdioApp,
  callTool,
  callToolAuto,
  findTool,
  listAllTools,
  listAllResources,
  readResource,
  disconnectAll,
  getConnectedCount,
  hasMcpAppsConfigured,
};
