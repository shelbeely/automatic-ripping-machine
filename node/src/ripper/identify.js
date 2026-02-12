const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createLogger } = require('./logger');
const { enhanceIdentification } = require('./ai_agent');

const logger = createLogger('identify');

function findMount(devpath) {
  try {
    const output = execSync(`mount | grep "${devpath}"`, { encoding: 'utf8', shell: true });
    const match = output.match(/on\s+(\S+)\s+type/);
    return match ? match[1] : null;
  } catch (err) {
    return null;
  }
}

function checkMount(job) {
  let mountpoint = findMount(job.devpath);
  if (!mountpoint) {
    try {
      const mountDir = `/mnt${job.devpath}`;
      if (!fs.existsSync(mountDir)) {
        fs.mkdirSync(mountDir, { recursive: true });
      }
      execSync(`mount ${job.devpath} ${mountDir}`, { shell: true });
      mountpoint = mountDir;
    } catch (err) {
      logger.error(`Failed to mount ${job.devpath}: ${err.message}`);
      return null;
    }
  }
  job.mountpoint = mountpoint;
  return mountpoint;
}

async function getVideoDetails(job) {
  const config = job.config || {};
  const omdbKey = config.OMDB_API_KEY || '';
  const tmdbKey = config.TMDB_API_KEY || '';

  if (!job.title) return job;

  if (omdbKey) {
    try {
      const params = { t: job.title, apikey: omdbKey };
      if (job.year) params.y = job.year;
      const response = await axios.get('http://www.omdbapi.com/', { params });
      if (response.data && response.data.Response === 'True') {
        job.title_auto = response.data.Title || job.title;
        job.year_auto = response.data.Year || job.year;
        job.video_type_auto = response.data.Type === 'series' ? 'series' : 'movie';
        job.imdb_id_auto = response.data.imdbID || '';
        job.poster_url_auto = response.data.Poster || '';
        job.hasnicetitle = true;
      }
    } catch (err) {
      logger.warn(`OMDB lookup failed: ${err.message}`);
    }
  }

  if (tmdbKey && !job.hasnicetitle) {
    try {
      const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
        params: { query: job.title, api_key: tmdbKey, year: job.year },
      });
      if (response.data && response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        job.title_auto = result.title || job.title;
        job.year_auto = (result.release_date || '').substring(0, 4);
        job.video_type_auto = 'movie';
        job.poster_url_auto = result.poster_path
          ? `https://image.tmdb.org/t/p/original${result.poster_path}`
          : '';
        job.hasnicetitle = true;
      }
    } catch (err) {
      logger.warn(`TMDB lookup failed: ${err.message}`);
    }
  }

  return job;
}

function identifyBluray(job) {
  const mountpoint = job.mountpoint || '';
  const xmlPath = path.join(mountpoint, 'BDMV', 'META', 'DL', 'bdmt_eng.xml');
  if (fs.existsSync(xmlPath)) {
    try {
      const content = fs.readFileSync(xmlPath, 'utf8');
      const titleMatch = content.match(/<di:name>(.*?)<\/di:name>/);
      if (titleMatch) {
        job.title = titleMatch[1].trim();
        job.label = job.title;
      }
    } catch (err) {
      logger.warn(`Failed to parse Blu-ray XML: ${err.message}`);
    }
  }
  return job;
}

function identifyDvd(job) {
  const mountpoint = job.mountpoint || '';
  if (mountpoint && fs.existsSync(path.join(mountpoint, 'VIDEO_TS'))) {
    // Use disc label as title
    try {
      const output = execSync(`blkid -o value -s LABEL ${job.devpath}`, {
        encoding: 'utf8',
        shell: true,
      }).trim();
      if (output) {
        job.title = output.replace(/_/g, ' ').trim();
        job.label = output;
      }
    } catch (err) {
      logger.warn(`Failed to get DVD label: ${err.message}`);
    }
  }
  return job;
}

async function identify(job) {
  logger.info(`Identifying disc at ${job.devpath}`);
  checkMount(job);

  const mountpoint = job.mountpoint || '';
  if (!mountpoint) {
    logger.error('Could not mount disc');
    return job;
  }

  // Detect disc type
  if (fs.existsSync(path.join(mountpoint, 'BDMV'))) {
    job.disctype = 'bluray';
    identifyBluray(job);
  } else if (fs.existsSync(path.join(mountpoint, 'VIDEO_TS'))) {
    job.disctype = 'dvd';
    identifyDvd(job);
  } else if (fs.existsSync(path.join(mountpoint, 'AUDIO_TS'))) {
    job.disctype = 'music';
  } else {
    job.disctype = 'data';
  }

  // Lookup metadata for video discs
  if (['dvd', 'bluray'].includes(job.disctype)) {
    await getVideoDetails(job);
  }

  // AI-powered identification: always use AI as the primary method
  // for resolving disc labels and enriching metadata
  const config = job.config || {};
  await enhanceIdentification(job, config);

  logger.info(`Identified: ${job.disctype} - ${job.title || 'unknown'}`);
  return job;
}

module.exports = {
  identify,
  identifyBluray,
  identifyDvd,
  findMount,
  checkMount,
  getVideoDetails,
};
