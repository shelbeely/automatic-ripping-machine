const {
  parseMcpAppsConfig,
  hasMcpAppsConfigured,
  listAllTools,
  getConnectedCount,
  findTool,
} = require('../src/mcp/mcp_client');

describe('MCP Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ARM_MCP_APPS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('parseMcpAppsConfig', () => {
    test('should return empty array when no config', () => {
      const result = parseMcpAppsConfig({});
      expect(result).toEqual([]);
    });

    test('should return apps from config', () => {
      const config = {
        MCP_APPS: [
          { name: 'test-app', command: 'node', args: ['server.js'] },
        ],
      };
      const result = parseMcpAppsConfig(config);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test-app');
    });

    test('should return apps from environment variable', () => {
      process.env.ARM_MCP_APPS = JSON.stringify([
        { name: 'env-app', command: 'npx', args: ['-y', '@some/server'] },
      ]);
      const result = parseMcpAppsConfig({});
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('env-app');
    });

    test('should prefer config over environment', () => {
      process.env.ARM_MCP_APPS = JSON.stringify([{ name: 'env-app' }]);
      const config = { MCP_APPS: [{ name: 'config-app', command: 'node' }] };
      const result = parseMcpAppsConfig(config);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('config-app');
    });

    test('should handle invalid JSON in environment variable', () => {
      process.env.ARM_MCP_APPS = 'not json';
      const result = parseMcpAppsConfig({});
      expect(result).toEqual([]);
    });

    test('should handle null config', () => {
      const result = parseMcpAppsConfig(null);
      expect(result).toEqual([]);
    });
  });

  describe('hasMcpAppsConfigured', () => {
    test('should return false when no apps configured', () => {
      expect(hasMcpAppsConfigured({})).toBe(false);
    });

    test('should return true when apps are configured', () => {
      const config = { MCP_APPS: [{ name: 'app', command: 'node' }] };
      expect(hasMcpAppsConfigured(config)).toBe(true);
    });
  });

  describe('listAllTools', () => {
    test('should return empty array when no apps connected', () => {
      expect(listAllTools()).toEqual([]);
    });
  });

  describe('getConnectedCount', () => {
    test('should return 0 when no apps connected', () => {
      expect(getConnectedCount()).toBe(0);
    });
  });

  describe('findTool', () => {
    test('should return null when no apps connected', () => {
      expect(findTool('some-tool')).toBeNull();
    });
  });
});
