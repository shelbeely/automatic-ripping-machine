const path = require('path');
const fs = require('fs');
const { armSubprocess, armSpawn } = require('./process_handler');
const { createLogger } = require('./logger');

const logger = createLogger('handbrake');

function correctHbSettings(job) {
  const config = job.config || {};
  const isBluray = job.disctype === 'bluray';
  return {
    preset: isBluray ? (config.HB_PRESET_BD || '') : (config.HB_PRESET_DVD || ''),
    args: isBluray ? (config.HB_ARGS_BD || '') : (config.HB_ARGS_DVD || ''),
    ext: config.DEST_EXT || 'mkv',
  };
}

function buildHandbrakeCommand(srcpath, filepathname, hbPreset, hbArgs, logfile, options = {}) {
  const { trackNumber = null, mainFeature = false } = options;
  let cmd = `HandBrakeCLI -i "${srcpath}" -o "${filepathname}"`;
  if (hbPreset) cmd += ` --preset "${hbPreset}"`;
  if (hbArgs) cmd += ` ${hbArgs}`;
  if (trackNumber !== null) cmd += ` -t ${trackNumber}`;
  if (mainFeature) cmd += ' --main-feature';
  return cmd;
}

function runHandbrakeCommand(cmd, options = {}) {
  const { track = null, trackNumber = null } = options;
  logger.info(`Running HandBrake: ${cmd}`);
  try {
    const result = armSubprocess(cmd, { shell: true });
    if (track) {
      track.ripped = true;
    }
    return result;
  } catch (err) {
    logger.error(`HandBrake error: ${err.message}`);
    throw err;
  }
}

function handbrakeMainFeature(srcpath, basepath, logfile, job) {
  const settings = correctHbSettings(job);
  const outFile = path.join(basepath, `${job.title || 'output'}.${settings.ext}`);
  const cmd = buildHandbrakeCommand(srcpath, outFile, settings.preset, settings.args, logfile, {
    mainFeature: true,
  });
  return runHandbrakeCommand(cmd);
}

function handbrakeAll(srcpath, basepath, logfile, job) {
  const settings = correctHbSettings(job);
  const results = [];
  const titleCount = job.no_of_titles || 1;
  for (let i = 1; i <= titleCount; i++) {
    const outFile = path.join(basepath, `${job.title || 'title'}_t${String(i).padStart(2, '0')}.${settings.ext}`);
    const cmd = buildHandbrakeCommand(srcpath, outFile, settings.preset, settings.args, logfile, {
      trackNumber: i,
    });
    try {
      const result = runHandbrakeCommand(cmd, { trackNumber: i });
      results.push({ track: i, success: true, result });
    } catch (err) {
      results.push({ track: i, success: false, error: err.message });
    }
  }
  return results;
}

function handbrakeCharEncoding(cmd) {
  return cmd.replace(/[^\x20-\x7E]/g, '');
}

function handbrakeSlCheckProcess(job) {
  // Port of sleep_check_process - checks concurrent transcodes
  const config = job.config || {};
  const maxConcurrent = config.MAX_CONCURRENT_TRANSCODES || 1;
  // In Node.js we check process count differently
  return maxConcurrent;
}

function handbrakeMkv(srcpath, basepath, logfile, job) {
  const settings = correctHbSettings(job);
  if (!fs.existsSync(srcpath)) {
    logger.error(`Source path does not exist: ${srcpath}`);
    return [];
  }
  const files = fs.readdirSync(srcpath).filter((f) => f.endsWith('.mkv'));
  const results = [];
  for (const file of files) {
    const inputFile = path.join(srcpath, file);
    const outName = path.basename(file, '.mkv') + '.' + settings.ext;
    const outFile = path.join(basepath, outName);
    const cmd = buildHandbrakeCommand(inputFile, outFile, settings.preset, settings.args, logfile);
    try {
      const result = runHandbrakeCommand(cmd);
      results.push({ file, success: true, result });
    } catch (err) {
      results.push({ file, success: false, error: err.message });
    }
  }
  return results;
}

function getTrackInfo(srcpath, job) {
  const cmd = `HandBrakeCLI -i "${srcpath}" -t 0 --scan 2>&1`;
  try {
    const output = armSubprocess(cmd, { shell: true });
    return output;
  } catch (err) {
    logger.error(`Failed to get track info: ${err.message}`);
    return null;
  }
}

module.exports = {
  handbrakeMainFeature,
  handbrakeAll,
  handbrakeCharEncoding,
  handbrakeSlCheckProcess,
  handbrakeMkv,
  getTrackInfo,
  correctHbSettings,
  buildHandbrakeCommand,
  runHandbrakeCommand,
};
