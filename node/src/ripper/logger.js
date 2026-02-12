const winston = require('winston');
const path = require('path');
const fs = require('fs');

function setupLogging(job) {
  const logDir = job.logfile ? path.dirname(job.logfile) : '/home/arm/logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level.toUpperCase()}] ${message}`;
      })
    ),
    transports: [
      new winston.transports.Console(),
    ],
  });
  if (job.logfile) {
    logger.add(new winston.transports.File({ filename: job.logfile }));
  }
  return logger;
}

function createLogger(appName, options = {}) {
  const { logLevel = 'debug', stdout = true, file = false, filePath = null } = options;
  const transports = [];
  if (stdout) {
    transports.push(new winston.transports.Console());
  }
  if (file && filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    transports.push(new winston.transports.File({ filename: filePath }));
  }
  return winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.label({ label: appName }),
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, label }) => {
        return `${timestamp} [${label}] [${level.toUpperCase()}] ${message}`;
      })
    ),
    transports,
  });
}

function cleanUpLogs(logPath, logLife) {
  if (!fs.existsSync(logPath)) return;
  const now = Date.now();
  const maxAge = logLife * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(logPath);
  for (const file of files) {
    const filePath = path.join(logPath, file);
    try {
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      // skip files we can't stat
    }
  }
}

module.exports = { setupLogging, createLogger, cleanUpLogs };
