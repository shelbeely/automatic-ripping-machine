const path = require('path');
const fs = require('fs');
const makemkv = require('./makemkv');
const handbrake = require('./handbrake');
const ffmpeg = require('./ffmpeg');
const utils = require('./utils');
const { createLogger } = require('./logger');
const { createAgent, requireAgent, recommendTranscodeSettings, diagnoseError } = require('./ai_agent');

const logger = createLogger('arm_ripper');

function ripWithMkv(job, protection) {
  const config = job.config || {};
  const ripMethod = config.RIPMETHOD || 'mkv';
  // Always need MakeMKV for encrypted discs or backup mode
  if (protection || ripMethod === 'backup' || ripMethod === 'backup_dvd') {
    return true;
  }
  if (ripMethod === 'mkv') {
    return true;
  }
  return false;
}

function notifyExit(job) {
  const hasErrors = job.errors && job.errors.length > 0;
  const title = hasErrors
    ? `ARM: ${job.title || 'Unknown'} completed with errors`
    : `ARM: ${job.title || 'Unknown'} completed successfully`;
  const body = `Disc: ${job.title || 'Unknown'}\nType: ${job.disctype}\nStatus: ${job.status}`;
  return utils.notify(job, title, body);
}

async function moveFilesPost(transcodeOutPath, job) {
  if (!fs.existsSync(transcodeOutPath)) {
    logger.warn(`Transcode output path does not exist: ${transcodeOutPath}`);
    return;
  }
  const files = fs.readdirSync(transcodeOutPath);
  for (const file of files) {
    utils.moveFiles(transcodeOutPath, file, job);
  }
  // Clean up empty directory
  try {
    fs.rmdirSync(transcodeOutPath);
  } catch (err) {
    // directory might not be empty
  }
}

async function startTranscode(job, logfile, rawInPath, transcodeOutPath, protection) {
  const config = job.config || {};
  utils.makeDir(transcodeOutPath);

  // AI agent: recommend transcode settings before starting
  const agent = createAgent(config);
  if (agent) {
    try {
      const videoInfo = {};
      if (fs.existsSync(rawInPath)) {
        const files = fs.readdirSync(rawInPath).filter((f) => f.endsWith('.mkv'));
        if (files.length > 0) {
          const probeData = ffmpeg.probeSource(path.join(rawInPath, files[0]));
          if (probeData && probeData.streams) {
            const video = probeData.streams.find((s) => s.codec_type === 'video');
            if (video) {
              videoInfo.resolution = `${video.width}x${video.height}`;
              videoInfo.codec = video.codec_name;
              videoInfo.bitrate = video.bit_rate;
            }
            videoInfo.audioTracks = probeData.streams.filter((s) => s.codec_type === 'audio').length;
            videoInfo.subtitleTracks = probeData.streams.filter((s) => s.codec_type === 'subtitle').length;
          }
          if (probeData && probeData.format) {
            videoInfo.duration = probeData.format.duration;
          }
        }
      }
      const recommendation = await recommendTranscodeSettings(agent, videoInfo, job);
      if (recommendation) {
        logger.info(`AI transcode recommendation: preset=${recommendation.preset || 'N/A'}, quality=${recommendation.quality || 'N/A'}, reasoning=${recommendation.reasoning || 'N/A'}`);
        job.ai_transcode_recommendation = recommendation;
      }
    } catch (err) {
      logger.warn(`AI transcode recommendation failed (continuing with defaults): ${err.message}`);
    }
  } else {
    logger.warn('AI agent not configured — using default transcode settings. Set AI_API_KEY for optimized encoding.');
  }

  await utils.databaseUpdater({ status: 'transcoding' }, job);

  if (config.USE_FFMPEG) {
    logger.info('Using FFMPEG for transcoding');
    return ffmpeg.ffmpegMkv(rawInPath, transcodeOutPath, job);
  }
  logger.info('Using HandBrake for transcoding');
  return handbrake.handbrakeMkv(rawInPath, transcodeOutPath, logfile, job);
}

async function ripVisualMedia(haveDupes, job, logfile, protection) {
  const config = job.config || {};
  const rawPath = config.RAW_PATH || '/home/arm/raw';
  const transcodePath = config.TRANSCODE_PATH || '/home/arm/transcode';
  const title = utils.fixJobTitle(job);
  const rawInPath = path.join(rawPath, utils.cleanForFilename(title));
  const transcodeOutPath = path.join(transcodePath, utils.cleanForFilename(title));

  try {
    // Phase 1: Rip
    if (ripWithMkv(job, protection)) {
      await utils.databaseUpdater({ status: 'ripping' }, job);
      logger.info(`Starting MakeMKV rip for: ${title}`);
      await makemkv.makemkv(job);
    }

    // Phase 2: Transcode
    if (!config.SKIP_TRANSCODE) {
      logger.info(`Starting transcode for: ${title}`);
      await startTranscode(job, logfile, rawInPath, transcodeOutPath, protection);
    }

    // Phase 3: Move files
    const sourcePath = config.SKIP_TRANSCODE ? rawInPath : transcodeOutPath;
    await moveFilesPost(sourcePath, job);

    // Phase 4: Post-processing
    if (config.EMBY_REFRESH) {
      await utils.scanEmby(config);
    }

    // Set permissions
    const completedPath = config.COMPLETED_PATH || '/home/arm/media/completed';
    const videoType = utils.convertJobType(job.video_type || '');
    const finalDir = videoType
      ? path.join(completedPath, videoType, utils.cleanForFilename(title))
      : path.join(completedPath, utils.cleanForFilename(title));
    utils.setPermissions(finalDir);

    // Clean raw files
    if (!config.SKIP_TRANSCODE) {
      utils.deleteRawFiles([rawInPath]);
    }

    await utils.databaseUpdater({ status: 'success', stop_time: new Date().toISOString() }, job);
    job.status = 'success';
  } catch (err) {
    logger.error(`Rip failed: ${err.message}`);

    // AI agent: diagnose the error
    const diagAgent = createAgent(config);
    if (diagAgent) {
      try {
        const diagnosis = await diagnoseError(diagAgent, err.message, {
          phase: job.status || 'unknown',
          tool: config.USE_FFMPEG ? 'FFmpeg' : 'HandBrake/MakeMKV',
          disctype: job.disctype,
          title: job.title,
        });
        if (diagnosis) {
          logger.info(`AI error diagnosis: ${diagnosis.diagnosis}`);
          if (diagnosis.suggestions) {
            logger.info(`AI suggestions: ${diagnosis.suggestions.join('; ')}`);
          }
          job.ai_error_diagnosis = diagnosis;
        }
      } catch (diagErr) {
        logger.warn(`AI error diagnosis failed: ${diagErr.message}`);
      }
    }

    await utils.databaseUpdater({
      status: 'fail',
      errors: (job.errors || '') + err.message,
      stop_time: new Date().toISOString(),
    }, job);
    job.status = 'fail';
  }

  await notifyExit(job);
  return job;
}

module.exports = {
  ripVisualMedia,
  startTranscode,
  notifyExit,
  moveFilesPost,
  ripWithMkv,
};
