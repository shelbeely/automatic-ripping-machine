const axios = require('axios');
const { createLogger } = require('./logger');
const utils = require('./utils');

const logger = createLogger('music_brainz');
const MB_BASE_URL = 'https://musicbrainz.org/ws/2';

async function getDiscInfo(job, discId) {
  try {
    const response = await axios.get(`${MB_BASE_URL}/discid/${discId}`, {
      params: { fmt: 'json', inc: 'recordings+artists' },
      headers: { 'User-Agent': 'ARM/1.0.0 (https://github.com/automatic-ripping-machine/automatic-ripping-machine)' },
    });
    return response.data;
  } catch (err) {
    logger.warn(`MusicBrainz disc lookup failed: ${err.message}`);
    return null;
  }
}

function checkDate(release) {
  if (!release) return '';
  return (release.date || '').substring(0, 4);
}

async function getTitle(discId, job) {
  const discInfo = await getDiscInfo(job, discId);
  if (!discInfo || !discInfo.releases || discInfo.releases.length === 0) {
    return { title: '', artist: '', year: '' };
  }
  const release = discInfo.releases[0];
  const title = release.title || '';
  const artistCredits = release['artist-credit'] || [];
  const artist = artistCredits.length > 0 ? artistCredits[0].name || '' : '';
  const year = checkDate(release);
  return { title, artist, year };
}

async function getCdArt(job, discInfo) {
  if (!discInfo || !discInfo.releases || discInfo.releases.length === 0) return false;
  const release = discInfo.releases[0];
  const mbid = release.id;
  try {
    const response = await axios.get(`https://coverartarchive.org/release/${mbid}`, {
      headers: { 'User-Agent': 'ARM/1.0.0' },
    });
    if (response.data && response.data.images && response.data.images.length > 0) {
      job.poster_url = response.data.images[0].image || '';
      return true;
    }
  } catch (err) {
    logger.warn(`Cover art lookup failed: ${err.message}`);
  }
  return false;
}

async function processTracks(job, trackList) {
  if (!trackList || !trackList.length) return;
  for (let i = 0; i < trackList.length; i++) {
    const mbTrack = trackList[i];
    const recording = mbTrack.recording || {};
    const length = recording.length ? Math.floor(recording.length / 1000) : 0;
    await utils.putTrack(job, i + 1, length, '', 0, false, 'music_brainz', recording.title || '');
  }
}

async function musicBrainz(discId, job) {
  const discInfo = await getDiscInfo(job, discId);
  if (!discInfo) {
    logger.warn('No MusicBrainz data found');
    return '';
  }

  const info = await getTitle(discId, job);
  if (info.title) {
    job.title = info.title;
    job.title_auto = info.title;
    job.year = info.year;
    job.year_auto = info.year;
    job.hasnicetitle = true;
  }

  await getCdArt(job, discInfo);

  // Process tracks
  if (discInfo.releases && discInfo.releases.length > 0) {
    const media = discInfo.releases[0].media || [];
    if (media.length > 0) {
      await processTracks(job, media[0].tracks || []);
    }
  }

  return info.title;
}

async function main(disc) {
  logger.info(`Music identification for ${disc.devpath}`);
  // discid would need the 'discid' npm package or system tool
  // For now, use disc label as fallback
  const discId = disc.crc_id || '';
  if (discId) {
    await musicBrainz(discId, disc);
  }
  return disc;
}

module.exports = {
  main,
  musicBrainz,
  getDiscInfo,
  getTitle,
  getCdArt,
  processTracks,
  checkDate,
};
