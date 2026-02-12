const path = require('path');
const fs = require('fs');
const { createLogger, cleanUpLogs } = require('../src/ripper/logger');

describe('Logger', () => {
  test('should create a logger', () => {
    const logger = createLogger('test-logger');
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.warn).toBeDefined();
  });

  test('should create logger with file transport', () => {
    const logFile = path.join(__dirname, 'test_logger.log');
    const logger = createLogger('file-test', { file: true, filePath: logFile });
    logger.info('test message');
    expect(logger).toBeDefined();
    // Clean up synchronously; file may or may not be flushed yet
    try {
      if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
      }
    } catch (e) {}
  });

  test('should clean up old logs', () => {
    const tmpDir = path.join(__dirname, 'tmp_logs');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    const oldFile = path.join(tmpDir, 'old.log');
    fs.writeFileSync(oldFile, 'old log');
    // Set mtime to 60 days ago
    const oldTime = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, oldTime, oldTime);
    cleanUpLogs(tmpDir, 30);
    expect(fs.existsSync(oldFile)).toBe(false);
    try { fs.rmdirSync(tmpDir); } catch (e) {}
  });
});
