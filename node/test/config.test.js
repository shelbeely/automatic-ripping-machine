const path = require('path');
const fs = require('fs');
const { loadConfig, loadAbcdeConfig, loadAppriseConfig } = require('../src/config/config');

describe('Configuration', () => {
  test('should return empty object for missing config', () => {
    const config = loadConfig('/nonexistent/path/config.yaml');
    expect(config).toEqual({});
  });

  test('should load YAML config file', () => {
    const tmpConfig = path.join(__dirname, 'test_config.yaml');
    fs.writeFileSync(tmpConfig, 'RIPMETHOD: mkv\nMAINFEATURE: true\nPORT: 8080\n');
    try {
      const config = loadConfig(tmpConfig);
      expect(config.RIPMETHOD).toBe('mkv');
      expect(config.MAINFEATURE).toBe(true);
      expect(config.PORT).toBe(8080);
    } finally {
      fs.unlinkSync(tmpConfig);
    }
  });

  test('should return empty string for missing abcde config', () => {
    const config = loadAbcdeConfig('/nonexistent/path/.abcde.conf');
    expect(config).toBe('');
  });

  test('should return empty object for missing apprise config', () => {
    const config = loadAppriseConfig('/nonexistent/path/apprise.yaml');
    expect(config).toEqual({});
  });
});
