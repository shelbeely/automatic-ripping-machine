const path = require('path');
const fs = require('fs');
const { armSubprocess, armSpawn } = require('./process_handler');
const { createLogger } = require('./logger');

const logger = createLogger('makemkv');

function convertToSeconds(hmsValue) {
  if (!hmsValue || typeof hmsValue !== 'string') return 0;
  const parts = hmsValue.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function parseLine(line) {
  if (!line || !line.includes(':')) return null;
  const colonIndex = line.indexOf(':');
  const prefix = line.substring(0, colonIndex);
  const content = line.substring(colonIndex + 1);
  return { prefix, content };
}

function parseContent(content) {
  if (!content) return [];
  return content.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
}

function setupRawpath(job, rawPath) {
  const outPath = path.join(rawPath, job.title || 'unknown');
  if (!fs.existsSync(outPath)) {
    fs.mkdirSync(outPath, { recursive: true });
  }
  return outPath;
}

function run(options, select) {
  const args = ['makemkvcon', ...options];
  if (select !== undefined && select !== null) {
    args.push(`--minlength=${select}`);
  }
  const cmd = args.join(' ');
  logger.info(`Running: ${cmd}`);
  return armSubprocess(cmd, { shell: true });
}

function makemkvInfo(job, options = {}) {
  const { select = null, index = 9999 } = options;
  const devPath = job.devpath || '';
  const args = ['info', `dev:${devPath}`, '--robot'];
  if (index !== 9999) args.push(`--sel=${index}`);
  return run(args, select);
}

function makemkvBackup(job, rawpath) {
  const devPath = job.devpath || '';
  const outPath = setupRawpath(job, rawpath);
  const args = ['backup', '--decrypt', `dev:${devPath}`, outPath, '--robot'];
  logger.info(`Starting backup rip for ${job.title || job.devpath}`);
  return run(args, null);
}

function makemkvMkv(job, rawpath) {
  const devPath = job.devpath || '';
  const outPath = setupRawpath(job, rawpath);
  const args = ['mkv', `dev:${devPath}`, 'all', outPath, '--robot'];
  logger.info(`Starting MKV rip for ${job.title || job.devpath}`);
  return run(args, null);
}

function ripMainfeature(job, track, rawpath) {
  const devPath = job.devpath || '';
  const outPath = setupRawpath(job, rawpath);
  const trackNum = track.track_number || 0;
  const args = ['mkv', `dev:${devPath}`, String(trackNum), outPath, '--robot'];
  logger.info(`Ripping main feature (track ${trackNum}) for ${job.title || job.devpath}`);
  return run(args, null);
}

async function makemkv(job) {
  const rawPath = job.config ? job.config.RAW_PATH : '/home/arm/raw';
  const ripMethod = job.config ? job.config.RIPMETHOD : 'mkv';

  if (ripMethod === 'backup' || ripMethod === 'backup_dvd') {
    return makemkvBackup(job, rawPath);
  }
  return makemkvMkv(job, rawPath);
}

function getTrackInfo(index, job) {
  const output = makemkvInfo(job, { index });
  if (!output) return null;
  const tracks = [];
  const lines = output.split('\n');
  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    if (parsed.prefix.startsWith('TINFO')) {
      const parts = parseContent(parsed.content);
      tracks.push({
        index: parseInt(parts[0]) || 0,
        attribute: parseInt(parts[1]) || 0,
        value: parts[2] || '',
      });
    }
  }
  return tracks;
}

module.exports = {
  makemkv,
  makemkvInfo,
  makemkvBackup,
  makemkvMkv,
  ripMainfeature,
  getTrackInfo,
  convertToSeconds,
  parseLine,
  parseContent,
  setupRawpath,
  run,
};
