const fs = require('fs');
const path = require('path');
const axios = require('axios');
const os = require('os');
const { execSync } = require('child_process');
const { createLogger } = require('./logger');

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

function moveFiles(basePath, filename, job, isMainFeature = false) {
  const videoType = convertJobType(job.video_type || '');
  const config = job.config || {};
  const completedPath = config.COMPLETED_PATH || '/home/arm/media/completed';
  const title = fixJobTitle(job);

  let finalDir;
  if (videoType) {
    finalDir = path.join(completedPath, videoType, cleanForFilename(title));
  } else {
    finalDir = path.join(completedPath, cleanForFilename(title));
  }

  makeDir(finalDir);

  const srcFile = path.join(basePath, filename);
  const destFile = path.join(finalDir, filename);

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
};
