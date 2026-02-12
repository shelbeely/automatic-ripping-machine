const {
  handleMessage,
  handleToolCall,
  handleResourceRead,
  TOOLS,
  RESOURCES,
  SERVER_INFO,
  MCP_PROTOCOL_VERSION,
} = require('../src/mcp/mcp_server');

describe('MCP Server', () => {
  describe('handleMessage', () => {
    test('should handle initialize', async () => {
      const msg = { method: 'initialize', id: 1, params: {} };
      const res = await handleMessage(msg, {});
      expect(res.jsonrpc).toBe('2.0');
      expect(res.id).toBe(1);
      expect(res.result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
      expect(res.result.serverInfo.name).toBe(SERVER_INFO.name);
    });

    test('should handle ping', async () => {
      const msg = { method: 'ping', id: 2 };
      const res = await handleMessage(msg, {});
      expect(res.jsonrpc).toBe('2.0');
      expect(res.id).toBe(2);
      expect(res.result).toEqual({});
    });

    test('should handle tools/list', async () => {
      const msg = { method: 'tools/list', id: 3 };
      const res = await handleMessage(msg, {});
      expect(res.result.tools).toEqual(TOOLS);
      expect(res.result.tools.length).toBeGreaterThan(0);
    });

    test('should handle resources/list', async () => {
      const msg = { method: 'resources/list', id: 4 };
      const res = await handleMessage(msg, {});
      expect(res.result.resources).toEqual(RESOURCES);
      expect(res.result.resources.length).toBeGreaterThan(0);
    });

    test('should return error for unknown method', async () => {
      const msg = { method: 'nonexistent/method', id: 5 };
      const res = await handleMessage(msg, {});
      expect(res.error).toBeDefined();
      expect(res.error.code).toBe(-32601);
    });
  });

  describe('handleToolCall', () => {
    test('should handle get_system_info', async () => {
      const result = await handleToolCall('get_system_info', {}, {});
      expect(result.hostname).toBeDefined();
      expect(result.platform).toBeDefined();
      expect(result.cpus).toBeGreaterThan(0);
      expect(result.nodeVersion).toBeDefined();
    });

    test('should return error for unknown tool', async () => {
      const result = await handleToolCall('nonexistent_tool', {}, {});
      expect(result.error).toContain('Unknown tool');
    });

    test('should return error for identify_disc without AI agent', async () => {
      const result = await handleToolCall('identify_disc', { label: 'TEST' }, {});
      expect(result.error).toContain('AI agent not configured');
    });

    test('should return error for diagnose_error without AI agent', async () => {
      const result = await handleToolCall('diagnose_error', { errorLog: 'test' }, {});
      expect(result.error).toContain('AI agent not configured');
    });
  });

  describe('handleResourceRead', () => {
    test('should handle arm://system', async () => {
      const result = await handleResourceRead('arm://system', {});
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('arm://system');
      expect(result.contents[0].mimeType).toBe('application/json');
      const data = JSON.parse(result.contents[0].text);
      expect(data.hostname).toBeDefined();
    });

    test('should handle arm://config with redaction', async () => {
      const config = { AI_API_KEY: 'secret-key', OMDB_API_KEY: 'another-secret', RIPMETHOD: 'mkv' };
      const result = await handleResourceRead('arm://config', config);
      const data = JSON.parse(result.contents[0].text);
      expect(data.AI_API_KEY).toBe('***REDACTED***');
      expect(data.OMDB_API_KEY).toBe('***REDACTED***');
      expect(data.RIPMETHOD).toBe('mkv');
    });

    test('should throw for unknown resource', async () => {
      await expect(handleResourceRead('arm://nonexistent', {})).rejects.toThrow('Unknown resource');
    });
  });

  describe('TOOLS', () => {
    test('should have required tool definitions', () => {
      const toolNames = TOOLS.map((t) => t.name);
      expect(toolNames).toContain('identify_disc');
      expect(toolNames).toContain('get_jobs');
      expect(toolNames).toContain('get_job');
      expect(toolNames).toContain('diagnose_error');
      expect(toolNames).toContain('recommend_transcode');
      expect(toolNames).toContain('generate_filename');
      expect(toolNames).toContain('get_system_info');
    });

    test('all tools should have inputSchema', () => {
      for (const tool of TOOLS) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });
  });

  describe('RESOURCES', () => {
    test('should have required resource definitions', () => {
      const uris = RESOURCES.map((r) => r.uri);
      expect(uris).toContain('arm://jobs');
      expect(uris).toContain('arm://config');
      expect(uris).toContain('arm://system');
    });
  });
});
