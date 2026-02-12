const express = require('express');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { createLogger } = require('../../ripper/logger');
const { loadConfig } = require('../../config/config');

const logger = createLogger('sendmovies');

const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests',
});

router.get('/send', sendLimiter, async (req, res) => {
  try {
    const config = loadConfig();
    const completedPath = config.COMPLETED_PATH || '/home/arm/media/completed';
    let files = [];
    if (fs.existsSync(completedPath)) {
      const entries = fs.readdirSync(completedPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(completedPath, entry.name);
        if (entry.isDirectory()) {
          const subFiles = listMediaFiles(fullPath, entry.name);
          files = files.concat(subFiles);
        } else if (isMediaFile(entry.name)) {
          const stats = fs.statSync(fullPath);
          files.push({
            name: entry.name,
            path: fullPath,
            folder: '',
            size: formatSize(stats.size),
            modified: stats.mtime.toISOString(),
          });
        }
      }
    }
    res.render('send', { title: 'Send Media', files, completedPath });
  } catch (err) {
    logger.error(`Send media error: ${err.message}`);
    res.status(500).render('error', { title: 'Error', error: err.message });
  }
});

function isMediaFile(name) {
  const ext = path.extname(name).toLowerCase();
  return ['.mkv', '.mp4', '.avi', '.m4v', '.iso', '.flac', '.mp3', '.wav'].indexOf(ext) !== -1;
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function listMediaFiles(dirPath, parentFolder, depth = 0) {
  const MAX_DEPTH = 5;
  const results = [];
  if (depth > MAX_DEPTH) return results;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        const subFolder = parentFolder ? `${parentFolder}/${entry.name}` : entry.name;
        results.push(...listMediaFiles(fullPath, subFolder, depth + 1));
      } else if (isMediaFile(entry.name) && !entry.isSymbolicLink()) {
        const stats = fs.statSync(fullPath);
        results.push({
          name: entry.name,
          path: fullPath,
          folder: parentFolder || '',
          size: formatSize(stats.size),
          modified: stats.mtime.toISOString(),
        });
      }
    }
  } catch (err) {
    logger.warn(`Cannot read directory ${dirPath}: ${err.message}`);
  }
  return results;
}

module.exports = router;
