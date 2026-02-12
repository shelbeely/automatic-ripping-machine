/**
 * MCP Server — exposes ARM's capabilities as MCP tools and resources.
 *
 * The web UI and other MCP-compatible apps connect to this server to
 * interact with ARM's ripping pipeline, AI agents, job management,
 * and system information.
 *
 * Provides an HTTP+JSON-RPC transport mounted at /mcp on the Express app.
 *
 * @see https://modelcontextprotocol.io
 */
const { createLogger } = require('../ripper/logger');
const { createAgent, parseDiscLabel, diagnoseError, recommendTranscodeSettings, generateMediaFilename } = require('../ripper/ai_agent');

const logger = createLogger('mcp_server');

const MCP_PROTOCOL_VERSION = '2024-11-05';

const SERVER_INFO = {
  name: 'arm-ripping-machine',
  version: '1.0.0',
};

const SERVER_CAPABILITIES = {
  tools: {},
  resources: {},
};

/**
 * Tool definitions exposed via MCP.
 */
const TOOLS = [
  {
    name: 'identify_disc',
    description: 'Parse a raw disc label into a clean movie/TV show title using AI.',
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'The raw disc label to identify' },
        disctype: { type: 'string', description: 'Type of disc: dvd, bluray, or music', enum: ['dvd', 'bluray', 'music', 'unknown'], default: 'unknown' },
      },
      required: ['label'],
    },
  },
  {
    name: 'get_jobs',
    description: 'List ripping jobs. Filter by status (active, success, fail) or get all jobs.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter: active, success, fail, or all', default: 'all' },
      },
    },
  },
  {
    name: 'get_job',
    description: 'Get detailed information about a specific ripping job by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'number', description: 'The job ID to look up' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'diagnose_error',
    description: 'Diagnose a ripping or transcoding error using AI.',
    inputSchema: {
      type: 'object',
      properties: {
        errorLog: { type: 'string', description: 'The error log text to diagnose' },
        phase: { type: 'string', description: 'Pipeline phase: ripping, transcoding, moving' },
        tool: { type: 'string', description: 'Tool: MakeMKV, HandBrake, FFmpeg' },
        disctype: { type: 'string', description: 'Type of disc' },
        title: { type: 'string', description: 'Title of the media' },
      },
      required: ['errorLog'],
    },
  },
  {
    name: 'recommend_transcode',
    description: 'Get AI-recommended transcode settings based on video metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        resolution: { type: 'string', description: 'e.g. 1920x1080' },
        codec: { type: 'string', description: 'e.g. h264' },
        bitrate: { type: 'string', description: 'Source bitrate' },
        disctype: { type: 'string', description: 'dvd or bluray', default: 'dvd' },
        audioTracks: { type: 'number' },
        subtitleTracks: { type: 'number' },
      },
    },
  },
  {
    name: 'generate_filename',
    description: 'Generate a Plex/Emby/Jellyfin-compatible filename for a media file.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Media title' },
        year: { type: 'string', description: 'Release year' },
        videoType: { type: 'string', enum: ['movie', 'series'] },
        label: { type: 'string', description: 'Disc label' },
      },
      required: ['title'],
    },
  },
  {
    name: 'get_system_info',
    description: 'Get ARM system information including CPU, memory, and configuration status.',
    inputSchema: { type: 'object', properties: {} },
  },
];

/**
 * Resource definitions exposed via MCP.
 */
const RESOURCES = [
  {
    uri: 'arm://jobs',
    name: 'Ripping Jobs',
    description: 'List of all ripping jobs and their statuses',
    mimeType: 'application/json',
  },
  {
    uri: 'arm://config',
    name: 'ARM Configuration',
    description: 'Current ARM configuration (sensitive values redacted)',
    mimeType: 'application/json',
  },
  {
    uri: 'arm://system',
    name: 'System Information',
    description: 'System hardware and software information',
    mimeType: 'application/json',
  },
];

/**
 * Handle MCP tool calls.
 */
async function handleToolCall(name, args, config) {
  const agent = createAgent(config);

  switch (name) {
    case 'identify_disc': {
      if (!agent) return { error: 'AI agent not configured' };
      const result = await parseDiscLabel(agent, args.label, args.disctype || 'unknown');
      return result || { error: 'Could not identify disc label' };
    }

    case 'get_jobs': {
      const { Job } = require('../models/job');
      const status = args.status || 'all';
      let jobs;
      if (status === 'active') {
        jobs = await Job.getActive();
      } else if (status !== 'all') {
        jobs = await Job.findAll({ status: status.split(',') });
      } else {
        jobs = await Job.findAll();
      }
      return { jobs: jobs.map((j) => j.toJSON()) };
    }

    case 'get_job': {
      const { Job } = require('../models/job');
      const { Track } = require('../models/track');
      const job = await Job.findById(args.job_id);
      if (!job) return { error: `Job ${args.job_id} not found` };
      const tracks = await Track.findByJobId(args.job_id);
      return { job: job.toJSON(), tracks: tracks.map((t) => t.toJSON()) };
    }

    case 'diagnose_error': {
      if (!agent) return { error: 'AI agent not configured' };
      const result = await diagnoseError(agent, args.errorLog, {
        phase: args.phase, tool: args.tool, disctype: args.disctype, title: args.title,
      });
      return result || { error: 'Could not diagnose error' };
    }

    case 'recommend_transcode': {
      if (!agent) return { error: 'AI agent not configured' };
      const videoInfo = {
        resolution: args.resolution, codec: args.codec, bitrate: args.bitrate,
        audioTracks: args.audioTracks, subtitleTracks: args.subtitleTracks,
      };
      const job = { disctype: args.disctype || 'dvd', config };
      const result = await recommendTranscodeSettings(agent, videoInfo, job);
      return result || { error: 'Could not generate recommendations' };
    }

    case 'generate_filename': {
      if (!agent) return { error: 'AI agent not configured' };
      const job = { title: args.title, year: args.year, video_type: args.videoType, label: args.label, config };
      const result = await generateMediaFilename(agent, job);
      return result || { error: 'Could not generate filename' };
    }

    case 'get_system_info': {
      const os = require('os');
      return {
        hostname: os.hostname(), platform: os.platform(), arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`,
        freeMemory: `${Math.round(os.freemem() / (1024 * 1024 * 1024))} GB`,
        uptime: `${Math.round(os.uptime() / 3600)} hours`,
        nodeVersion: process.version, aiConfigured: !!agent,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/**
 * Handle MCP resource reads.
 */
async function handleResourceRead(uri, config) {
  switch (uri) {
    case 'arm://jobs': {
      const { Job } = require('../models/job');
      const jobs = await Job.findAll();
      return {
        contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ jobs: jobs.map((j) => j.toJSON()) }) }],
      };
    }

    case 'arm://config': {
      const safeConfig = { ...config };
      const sensitiveKeys = ['AI_API_KEY', 'OMDB_API_KEY', 'TMDB_API_KEY', 'PB_KEY', 'IFTTT_KEY', 'PO_USER_KEY', 'PO_APP_KEY', 'EMBY_API_KEY'];
      for (const key of sensitiveKeys) {
        if (safeConfig[key]) safeConfig[key] = '***REDACTED***';
      }
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(safeConfig) }] };
    }

    case 'arm://system': {
      const os = require('os');
      return {
        contents: [{
          uri, mimeType: 'application/json',
          text: JSON.stringify({
            hostname: os.hostname(), platform: os.platform(),
            cpus: os.cpus().length,
            totalMemory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`,
            nodeVersion: process.version,
          }),
        }],
      };
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
}

/**
 * Process a JSON-RPC 2.0 MCP message.
 */
async function handleMessage(message, config) {
  const { method, params = {}, id } = message;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0', id,
          result: { protocolVersion: MCP_PROTOCOL_VERSION, serverInfo: SERVER_INFO, capabilities: SERVER_CAPABILITIES },
        };

      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: TOOLS } };

      case 'tools/call': {
        const result = await handleToolCall(params.name, params.arguments || {}, config);
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } };
      }

      case 'resources/list':
        return { jsonrpc: '2.0', id, result: { resources: RESOURCES } };

      case 'resources/read': {
        const resourceResult = await handleResourceRead(params.uri, config);
        return { jsonrpc: '2.0', id, result: resourceResult };
      }

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
  } catch (err) {
    logger.error(`MCP error handling ${method}: ${err.message}`);
    return { jsonrpc: '2.0', id, error: { code: -32603, message: err.message } };
  }
}

/**
 * Create an Express router that serves the MCP server over HTTP.
 *
 * Mounts at /mcp and provides:
 * - POST /mcp/message — JSON-RPC 2.0 endpoint
 * - GET  /mcp/sse     — Server-Sent Events stream
 * - GET  /mcp         — Discovery/metadata endpoint
 */
function createMcpRouter(config) {
  const express = require('express');
  const router = express.Router();

  router.post('/message', async (req, res) => {
    const message = req.body;
    if (!message || !message.method) {
      return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } });
    }
    const response = await handleMessage(message, config);
    res.json(response);
  });

  router.get('/sse', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    res.write(`data: ${JSON.stringify({ type: 'connection', status: 'connected', server: SERVER_INFO })}\n\n`);
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }, 30000);
    req.on('close', () => clearInterval(heartbeat));
  });

  router.get('/', (req, res) => {
    res.json({
      name: SERVER_INFO.name, version: SERVER_INFO.version,
      protocolVersion: MCP_PROTOCOL_VERSION, capabilities: SERVER_CAPABILITIES,
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
      resources: RESOURCES.map((r) => ({ uri: r.uri, name: r.name, description: r.description })),
    });
  });

  return router;
}

module.exports = {
  handleMessage,
  handleToolCall,
  handleResourceRead,
  createMcpRouter,
  TOOLS,
  RESOURCES,
  SERVER_INFO,
  SERVER_CAPABILITIES,
  MCP_PROTOCOL_VERSION,
};
