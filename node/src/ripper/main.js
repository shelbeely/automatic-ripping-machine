const path = require('path');
const fs = require('fs');
const { Job, JobState, Config } = require('../models');
const { loadConfig } = require('../config/config');
const { identify } = require('./identify');
const armRipper = require('./arm_ripper');
const musicBrainz = require('./music_brainz');
const utils = require('./utils');
const { requireAgent } = require('./ai_agent');
const { initializeMcpApps, hasMcpAppsConfigured, disconnectAll: disconnectMcpApps } = require('../mcp/mcp_client');
const { setupLogging, createLogger } = require('./logger');

const logger = createLogger('main');

async function entry() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node src/ripper/main.js <device_path>');
    process.exit(1);
  }

  const devpath = args[0];
  logger.info(`ARM started for device: ${devpath}`);

  // Validate AI configuration at startup — AI is required in this fork
  const armConfig = loadConfig();
  try {
    requireAgent(armConfig);
    logger.info('AI agent configured and ready');
  } catch (err) {
    logger.error(`AI configuration error: ${err.message}`);
    logger.error('This fork requires an AI API key. See README.md for setup instructions.');
    process.exit(1);
  }

  // Initialize MCP app connections (if configured)
  if (hasMcpAppsConfigured(armConfig)) {
    try {
      await initializeMcpApps(armConfig);
    } catch (err) {
      logger.warn(`MCP apps initialization failed (continuing without): ${err.message}`);
    }
  }

  // Check for duplicate runs
  if (utils.duplicateRunCheck(devpath)) {
    logger.warn(`Duplicate run detected for ${devpath}, exiting`);
    process.exit(1);
  }

  // Create job
  const job = new Job({
    devpath,
    status: JobState.ACTIVE,
    start_time: new Date().toISOString(),
    pid: process.pid,
  });

  // Create config snapshot for this job
  const configModel = new Config(armConfig);
  await configModel.save();
  job.config_id = configModel.config_id;
  job.config = configModel;
  await job.save();

  const logfile = path.join(
    armConfig.LOGPATH || '/home/arm/logs',
    `arm_${job.job_id}_${new Date().toISOString().replace(/[:.]/g, '-')}.log`
  );
  job.logfile = logfile;
  await job.save();

  const jobLogger = setupLogging(job);

  try {
    await main(logfile, job);
  } catch (err) {
    jobLogger.error(`Fatal error: ${err.message}`);
    await utils.databaseUpdater({
      status: JobState.FAIL,
      errors: err.message,
      stop_time: new Date().toISOString(),
    }, job);
  }

  // Disconnect MCP apps on exit
  await disconnectMcpApps();
}

async function main(logfile, job) {
  logger.info(`Processing disc at ${job.devpath}`);

  // Identify the disc
  await identify(job);
  await job.save();

  // Check for duplicates
  const dupe = await utils.jobDupeCheck(job);
  const haveDupes = dupe !== null;

  // Route based on disc type
  switch (job.disctype) {
    case 'bluray':
    case 'dvd':
      logger.info(`Video disc detected: ${job.disctype}`);
      await armRipper.ripVisualMedia(haveDupes, job, logfile, false);
      break;

    case 'music':
      logger.info('Music disc detected');
      await utils.databaseUpdater({ status: 'ripping' }, job);
      await musicBrainz.main(job);
      const musicResult = utils.ripMusic(job, logfile);
      if (musicResult) {
        await utils.databaseUpdater({ status: 'success', stop_time: new Date().toISOString() }, job);
      } else {
        await utils.databaseUpdater({ status: 'fail', stop_time: new Date().toISOString() }, job);
      }
      break;

    case 'data':
      logger.info('Data disc detected');
      await utils.databaseUpdater({ status: 'ripping' }, job);
      const dataResult = utils.ripData(job);
      if (dataResult) {
        await utils.databaseUpdater({ status: 'success', stop_time: new Date().toISOString() }, job);
      } else {
        await utils.databaseUpdater({ status: 'fail', stop_time: new Date().toISOString() }, job);
      }
      break;

    default:
      logger.error(`Unknown disc type: ${job.disctype}`);
      await utils.databaseUpdater({ status: 'fail', errors: 'Unknown disc type', stop_time: new Date().toISOString() }, job);
  }
}

module.exports = { entry, main };

// Run if called directly
if (require.main === module) {
  entry().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
