const { startServer } = require('./ui/server');
const { loadConfig } = require('./config/config');
const { createLogger } = require('./ripper/logger');

const logger = createLogger('ARM');

async function main() {
  logger.info('Starting Automatic Ripping Machine (Node.js)');

  // Load configuration
  const config = loadConfig();
  const port = config.WEBSERVER_PORT || 8080;

  // Start web server
  await startServer({ port });
}

main().catch((err) => {
  console.error('Failed to start ARM:', err);
  process.exit(1);
});
