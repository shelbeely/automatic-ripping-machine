const path = require('path');
const fs = require('fs');
const { armSubprocess, armSpawn } = require('./process_handler');
const { createLogger } = require('./logger');

const logger = createLogger('ffmpeg');

function correctFfmpegSettings(job) {
  const config = job.config || {};
  const isBluray = job.disctype === 'bluray';
  return {
    preArgs: isBluray ? (config.FFMPEG_PRE_ARGS_BD || '') : (config.FFMPEG_PRE_ARGS_DVD || ''),
    postArgs: isBluray ? (config.FFMPEG_ARGS_BD || '') : (config.FFMPEG_ARGS_DVD || ''),
    ext: config.DEST_EXT || 'mkv',
  };
}

function probeSource(srcPath) {
  const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${srcPath}"`;
  try {
    const output = armSubprocess(cmd, { shell: true });
    return JSON.parse(output);
  } catch (err) {
    logger.error(`ffprobe error: ${err.message}`);
    return null;
  }
}

function parseProbeOutput(jsonStr) {
  try {
    const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    const streams = data.streams || [];
    const format = data.format || {};
    return { streams, format };
  } catch (err) {
    logger.error(`Failed to parse probe output: ${err.message}`);
    return { streams: [], format: {} };
  }
}

function parseFps(fpsRaw) {
  if (!fpsRaw) return 0;
  if (typeof fpsRaw === 'number') return fpsRaw;
  const str = String(fpsRaw);
  if (str.includes('/')) {
    const [num, den] = str.split('/').map(Number);
    return den ? num / den : 0;
  }
  return parseFloat(str) || 0;
}

function computeAspect(width, height) {
  if (!width || !height) return '';
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const d = gcd(width, height);
  return `${width / d}:${height / d}`;
}

function evaluateAndRegisterTracks(tracks, job) {
  let mainFeatureTrack = null;
  let maxDuration = 0;
  for (const track of tracks) {
    const duration = track.duration || 0;
    if (duration > maxDuration) {
      maxDuration = duration;
      mainFeatureTrack = track;
    }
  }
  return { mainFeatureTrack, tracks };
}

function runTranscodeCmd(srcFile, outFile, job, options = {}) {
  const { ffPreArgs = '', ffPostArgs = '' } = options;
  let cmd = 'ffmpeg';
  if (ffPreArgs) cmd += ` ${ffPreArgs}`;
  cmd += ` -i "${srcFile}"`;
  if (ffPostArgs) cmd += ` ${ffPostArgs}`;
  cmd += ` "${outFile}"`;
  logger.info(`Running: ${cmd}`);
  return armSubprocess(cmd, { shell: true });
}

function ffmpegMainFeature(srcPath, outPath, job) {
  const settings = correctFfmpegSettings(job);
  const outFile = path.join(outPath, `${job.title || 'output'}.${settings.ext}`);
  return runTranscodeCmd(srcPath, outFile, job, {
    ffPreArgs: settings.preArgs,
    ffPostArgs: settings.postArgs,
  });
}

function ffmpegAll(srcPath, basePath, job) {
  const settings = correctFfmpegSettings(job);
  if (!fs.existsSync(srcPath)) {
    logger.error(`Source path does not exist: ${srcPath}`);
    return [];
  }
  const files = fs.readdirSync(srcPath).filter((f) => f.endsWith('.mkv'));
  const results = [];
  for (const file of files) {
    const inputFile = path.join(srcPath, file);
    const outName = path.basename(file, '.mkv') + '.' + settings.ext;
    const outFile = path.join(basePath, outName);
    try {
      runTranscodeCmd(inputFile, outFile, job, {
        ffPreArgs: settings.preArgs,
        ffPostArgs: settings.postArgs,
      });
      results.push({ file, success: true });
    } catch (err) {
      results.push({ file, success: false, error: err.message });
    }
  }
  return results;
}

function ffmpegMkv(srcPath, basePath, job) {
  return ffmpegAll(srcPath, basePath, job);
}

function getTrackInfo(srcPath, job) {
  return probeSource(srcPath);
}

module.exports = {
  correctFfmpegSettings,
  probeSource,
  parseProbeOutput,
  parseFps,
  computeAspect,
  evaluateAndRegisterTracks,
  runTranscodeCmd,
  ffmpegMainFeature,
  ffmpegAll,
  ffmpegMkv,
  getTrackInfo,
};
