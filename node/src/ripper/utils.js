const fs = require('fs');
const path = require('path');
const axios = require('axios');
const os = require('os');
const { execSync } = require('child_process');
const { createLogger } = require('./logger');
const { createAgent, generateMediaFilename, fetchMediaCredits, MIN_CONFIDENCE_THRESHOLD } = require('./ai_agent');

const logger = createLogger('utils');

async function notify(job, title, body) {
  const config = job.config || {};
  const notifications = [];

  // Database notification
  try {
    const { Notification } = require('../models/notifications');
    const notif = new Notification({ title, message: body });
    await notif.save();
  } catch (err) {
    logger.warn(`DB notification failed: ${err.message}`);
  }

  // PushBullet
  if (config.PB_KEY) {
    try {
      await axios.post('https://api.pushbullet.com/v2/pushes', {
        type: 'note', title, body,
      }, {
        headers: { 'Access-Token': config.PB_KEY },
      });
      notifications.push('pushbullet');
    } catch (err) {
      logger.warn(`PushBullet notification failed: ${err.message}`);
    }
  }

  // IFTTT
  if (config.IFTTT_KEY && config.IFTTT_EVENT) {
    try {
      await axios.post(
        `https://maker.ifttt.com/trigger/${config.IFTTT_EVENT}/with/key/${config.IFTTT_KEY}`,
        { value1: title, value2: body }
      );
      notifications.push('ifttt');
    } catch (err) {
      logger.warn(`IFTTT notification failed: ${err.message}`);
    }
  }

  // Pushover
  if (config.PO_USER_KEY && config.PO_APP_KEY) {
    try {
      await axios.post('https://api.pushover.net/1/messages.json', {
        token: config.PO_APP_KEY,
        user: config.PO_USER_KEY,
        title,
        message: body,
      });
      notifications.push('pushover');
    } catch (err) {
      logger.warn(`Pushover notification failed: ${err.message}`);
    }
  }

  // JSON webhook
  if (config.JSON_URL) {
    try {
      await axios.post(config.JSON_URL, { title, body });
      notifications.push('json_webhook');
    } catch (err) {
      logger.warn(`JSON webhook notification failed: ${err.message}`);
    }
  }

  return notifications;
}

function convertJobType(videoType) {
  if (!videoType) return '';
  const typeMap = { movie: 'movies', series: 'tv', 'tv show': 'tv' };
  return typeMap[videoType.toLowerCase()] || videoType;
}

function fixJobTitle(job) {
  let title = job.title || 'unknown';
  if (job.year) {
    title += ` (${job.year})`;
  }
  return title;
}

function cleanForFilename(str) {
  if (!str) return '';
  return str
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.debug(`Created directory: ${dirPath}`);
  }
}

async function moveFiles(basePath, filename, job, isMainFeature = false) {
  const videoType = convertJobType(job.video_type || '');
  const config = job.config || {};
  const completedPath = config.COMPLETED_PATH || '/home/arm/media/completed';
  const title = fixJobTitle(job);

  let finalDir;
  let destFilename = filename;

  // AI agent: generate proper media-library filenames
  const agent = createAgent(config);
  if (agent) {
    try {
      const ext = path.extname(filename);
      const suggestion = await generateMediaFilename(agent, job, {
        filename,
        trackNumber: isMainFeature ? 0 : undefined,
      });
      if (suggestion && suggestion.confidence >= MIN_CONFIDENCE_THRESHOLD) {
        if (suggestion.directory) {
          finalDir = path.join(completedPath, suggestion.directory);
          logger.info(`AI file naming: directory -> ${finalDir}`);
        }
        if (suggestion.filename) {
          destFilename = suggestion.filename;
          logger.info(`AI file naming: filename -> ${destFilename}`);
        }
      }
    } catch (err) {
      logger.warn(`AI file naming failed: ${err.message}`);
    }
  }

  if (!finalDir) {
    if (videoType) {
      finalDir = path.join(completedPath, videoType, cleanForFilename(title));
    } else {
      finalDir = path.join(completedPath, cleanForFilename(title));
    }
  }

  makeDir(finalDir);

  const srcFile = path.join(basePath, filename);
  const destFile = path.join(finalDir, destFilename);

  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    fs.unlinkSync(srcFile);
    logger.info(`Moved: ${srcFile} -> ${destFile}`);
    return destFile;
  }
  logger.warn(`File not found for move: ${srcFile}`);
  return null;
}

function findFile(filename, searchPath) {
  if (!fs.existsSync(searchPath)) return null;
  const entries = fs.readdirSync(searchPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(searchPath, entry.name);
    if (entry.isFile() && entry.name === filename) return fullPath;
    if (entry.isDirectory()) {
      const found = findFile(filename, fullPath);
      if (found) return found;
    }
  }
  return null;
}

function findLargestFile(files, basePath) {
  let largest = null;
  let maxSize = 0;
  for (const file of files) {
    const filePath = path.join(basePath, file);
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > maxSize) {
        maxSize = stats.size;
        largest = file;
      }
    } catch (err) {
      // skip files we can't stat
    }
  }
  return largest;
}

function deleteRawFiles(dirList) {
  for (const dir of dirList) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      logger.info(`Deleted: ${dir}`);
    }
  }
}

function setPermissions(directoryToTraverse) {
  if (!fs.existsSync(directoryToTraverse)) return;
  try {
    fs.chmodSync(directoryToTraverse, 0o775);
    const entries = fs.readdirSync(directoryToTraverse, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directoryToTraverse, entry.name);
      if (entry.isDirectory()) {
        fs.chmodSync(fullPath, 0o775);
        setPermissions(fullPath);
      } else {
        fs.chmodSync(fullPath, 0o664);
      }
    }
  } catch (err) {
    logger.warn(`Failed to set permissions on ${directoryToTraverse}: ${err.message}`);
  }
}

function ripMusic(job, logfile) {
  const config = job.config || {};
  const cmd = `abcde -d ${job.devpath} -o flac -N 2>&1`;
  logger.info(`Starting music rip: ${cmd}`);
  try {
    const result = execSync(cmd, { encoding: 'utf8', shell: true, timeout: 3600000 });
    return result;
  } catch (err) {
    logger.error(`Music rip failed: ${err.message}`);
    return null;
  }
}

function ripData(job) {
  const config = job.config || {};
  const completedPath = config.COMPLETED_PATH || '/home/arm/media/completed';
  const mountpoint = job.mountpoint || '';
  const title = cleanForFilename(job.title || job.label || 'data_disc');
  const outPath = path.join(completedPath, title);
  makeDir(outPath);

  const cmd = `cp -r "${mountpoint}/." "${outPath}/"`;
  logger.info(`Copying data disc: ${cmd}`);
  try {
    execSync(cmd, { shell: true });
    return outPath;
  } catch (err) {
    logger.error(`Data rip failed: ${err.message}`);
    return null;
  }
}

async function scanEmby(config) {
  if (!config || !config.EMBY_REFRESH) return false;
  const server = config.EMBY_SERVER || '';
  const port = config.EMBY_PORT || 8096;
  const apiKey = config.EMBY_API_KEY || '';
  if (!server || !apiKey) return false;

  try {
    await axios.post(`http://${server}:${port}/Library/Refresh?api_key=${apiKey}`);
    logger.info('Emby library scan triggered');
    return true;
  } catch (err) {
    logger.warn(`Emby scan failed: ${err.message}`);
    return false;
  }
}

async function databaseUpdater(args, job, waitTime = 90) {
  const { getDatabase } = require('../models/database');
  const db = getDatabase();
  try {
    await db('job').where('job_id', job.job_id).update(args);
    return true;
  } catch (err) {
    logger.error(`Database update failed: ${err.message}`);
    return false;
  }
}

async function databaseAdder(tableName, data) {
  const { getDatabase } = require('../models/database');
  const db = getDatabase();
  try {
    const [id] = await db(tableName).insert(data);
    return id;
  } catch (err) {
    logger.error(`Database insert failed: ${err.message}`);
    return null;
  }
}

async function putTrack(job, trackNo, seconds, aspect, fps, mainfeature, source, filename) {
  const { Track } = require('../models/track');
  const track = new Track({
    job_id: job.job_id,
    track_number: trackNo,
    length: seconds,
    aspect_ratio: aspect,
    fps: fps,
    main_feature: mainfeature,
    source: source,
    basename: filename,
    filename: filename,
    ripped: false,
  });
  await track.save();
  return track;
}

function checkIp() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        addresses.push(addr.address);
      }
    }
  }
  return addresses;
}

async function cleanOldJobs(retentionDays = 30) {
  const { getDatabase } = require('../models/database');
  const db = getDatabase();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    const deleted = await db('job').where('start_time', '<', cutoff).del();
    logger.info(`Cleaned ${deleted} old jobs`);
    return deleted;
  } catch (err) {
    logger.error(`Failed to clean old jobs: ${err.message}`);
    return 0;
  }
}

function duplicateRunCheck(devPath) {
  // Check if another process is running for this device
  try {
    const output = execSync(`ps aux | grep "${devPath}" | grep -v grep`, {
      encoding: 'utf8',
      shell: true,
    });
    const lines = output.trim().split('\n').filter(Boolean);
    return lines.length > 1;
  } catch (err) {
    return false;
  }
}

async function jobDupeCheck(job) {
  const { getDatabase } = require('../models/database');
  const db = getDatabase();
  if (!job.crc_id) return null;
  const existing = await db('job')
    .where('crc_id', job.crc_id)
    .whereNot('job_id', job.job_id || 0)
    .whereIn('status', ['success'])
    .first();
  return existing || null;
}

async function tryAddDefaultUser() {
  const { User } = require('../models/user');
  const existing = await User.findByEmail('admin');
  if (!existing) {
    const hashedPw = await User.hashPassword('password');
    const user = new User({
      email: 'admin',
      password: hashedPw,
      hash: '',
    });
    await user.save();
    logger.info('Default admin user created');
  }
}

/**
 * Escape special XML characters in a string.
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate Matroska XML tags from structured credits metadata.
 *
 * Follows the Matroska tagging specification for movies/TV:
 * https://www.matroska.org/technical/tagging.html
 *
 * @param {object} credits — credits object from fetchMediaCredits
 * @returns {string} XML string suitable for mkvpropedit --tags
 */
function generateMkvTagsXml(credits) {
  if (!credits) return null;

  const tag = (name, value) => {
    if (!value && value !== 0) return '';
    return `      <Simple>\n        <Name>${escapeXml(name)}</Name>\n        <String>${escapeXml(String(value))}</String>\n      </Simple>\n`;
  };

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Tags>\n  <Tag>\n    <Targets>\n      <TargetTypeValue>50</TargetTypeValue>\n    </Targets>\n';

  if (credits.title) xml += tag('TITLE', credits.title);
  if (credits.original_title) xml += tag('ORIGINAL_TITLE', credits.original_title);
  if (credits.subtitle) xml += tag('SUBTITLE', credits.subtitle);
  // Prefer release_date over year for DATE_RELEASED to avoid duplicates
  if (credits.release_date) {
    xml += tag('DATE_RELEASED', credits.release_date);
  } else if (credits.year) {
    xml += tag('DATE_RELEASED', credits.year);
  }
  if (credits.synopsis) xml += tag('SYNOPSIS', credits.synopsis);
  if (credits.tagline) xml += tag('SUMMARY', credits.tagline);
  if (credits.language) xml += tag('LANGUAGE', credits.language);
  if (credits.country) xml += tag('COUNTRY', credits.country);
  if (credits.rating) xml += tag('LAW_RATING', credits.rating);
  if (credits.studio) xml += tag('PRODUCTION_STUDIO', credits.studio);
  if (credits.copyright) xml += tag('COPYRIGHT', credits.copyright);
  if (credits.distributor) xml += tag('DISTRIBUTOR', credits.distributor);

  if (Array.isArray(credits.genre)) {
    for (const g of credits.genre) {
      xml += tag('GENRE', g);
    }
  }

  if (Array.isArray(credits.keywords)) {
    for (const k of credits.keywords) {
      xml += tag('KEYWORDS', k);
    }
  }

  if (Array.isArray(credits.director)) {
    for (const d of credits.director) {
      xml += tag('DIRECTOR', d);
    }
  }

  if (Array.isArray(credits.producer)) {
    for (const p of credits.producer) {
      xml += tag('PRODUCER', p);
    }
  }

  if (Array.isArray(credits.writer)) {
    for (const w of credits.writer) {
      xml += tag('WRITTEN_BY', w);
    }
  }

  if (Array.isArray(credits.composer)) {
    for (const c of credits.composer) {
      xml += tag('COMPOSER', c);
    }
  }

  if (Array.isArray(credits.cinematographer)) {
    for (const c of credits.cinematographer) {
      xml += tag('CINEMATOGRAPHER', c);
    }
  }

  if (Array.isArray(credits.editor)) {
    for (const e of credits.editor) {
      xml += tag('EDITED_BY', e);
    }
  }

  if (Array.isArray(credits.production_designer)) {
    for (const pd of credits.production_designer) {
      xml += tag('PRODUCTION_DESIGNER', pd);
    }
  }

  if (Array.isArray(credits.costume_designer)) {
    for (const cd of credits.costume_designer) {
      xml += tag('COSTUME_DESIGNER', cd);
    }
  }

  if (Array.isArray(credits.cast)) {
    for (const member of credits.cast) {
      if (member.actor) {
        const actorTag = member.character
          ? `${member.actor} as ${member.character}`
          : member.actor;
        xml += tag('ACTOR', actorTag);
      }
    }
  }

  if (credits.comment) xml += tag('COMMENT', credits.comment);

  xml += '  </Tag>\n</Tags>\n';
  return xml;
}

/**
 * Write MKV tags to a file using mkvpropedit.
 *
 * Generates an XML tag file from credits metadata and applies it
 * to the specified MKV file. Uses AI to fetch credits if not provided.
 *
 * @param {string} mkvPath — path to the MKV file
 * @param {object} job — job object with title, year, video_type, config
 * @param {object} [credits] — pre-fetched credits; if null, fetches via AI
 * @returns {object|null} — { tagged: true, credits } on success, null on failure
 */
async function writeMkvTags(mkvPath, job, credits) {
  if (!mkvPath || !fs.existsSync(mkvPath)) {
    logger.warn(`MKV tagging skipped: file not found: ${mkvPath}`);
    return null;
  }

  const config = job.config || {};

  // Fetch credits via AI if not provided
  if (!credits) {
    const agent = createAgent(config);
    if (!agent) {
      logger.warn('MKV tagging skipped: AI agent not configured');
      return null;
    }
    try {
      credits = await fetchMediaCredits(agent, job.title, job.year, job.video_type);
    } catch (err) {
      logger.warn(`MKV tagging: failed to fetch credits: ${err.message}`);
      return null;
    }
  }

  if (!credits) {
    logger.warn('MKV tagging skipped: no credits data available');
    return null;
  }

  const xml = generateMkvTagsXml(credits);
  if (!xml) {
    logger.warn('MKV tagging skipped: could not generate XML tags');
    return null;
  }

  // Write XML to a temp file next to the MKV
  const tagFile = mkvPath + '.tags.xml';
  try {
    fs.writeFileSync(tagFile, xml, 'utf8');
    logger.info(`MKV tags XML written to: ${tagFile}`);

    // Apply tags using mkvpropedit
    const cmd = `mkvpropedit "${mkvPath}" --tags global:"${tagFile}"`;
    logger.info(`Applying MKV tags: ${cmd}`);
    execSync(cmd, { shell: true, encoding: 'utf8' });
    logger.info(`MKV tags applied to: ${mkvPath}`);

    return { tagged: true, credits };
  } catch (err) {
    logger.warn(`MKV tagging failed for ${mkvPath}: ${err.message}`);
    return null;
  } finally {
    // Clean up temp tag file
    try {
      if (fs.existsSync(tagFile)) fs.unlinkSync(tagFile);
    } catch (cleanErr) {
      // ignore cleanup errors
    }
  }
}

module.exports = {
  notify,
  convertJobType,
  fixJobTitle,
  cleanForFilename,
  makeDir,
  moveFiles,
  findFile,
  findLargestFile,
  deleteRawFiles,
  setPermissions,
  ripMusic,
  ripData,
  scanEmby,
  databaseUpdater,
  databaseAdder,
  putTrack,
  checkIp,
  cleanOldJobs,
  duplicateRunCheck,
  jobDupeCheck,
  tryAddDefaultUser,
  escapeXml,
  generateMkvTagsXml,
  writeMkvTags,
};
