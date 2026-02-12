const main = require('./main');
const armRipper = require('./arm_ripper');
const identify = require('./identify');
const makemkv = require('./makemkv');
const handbrake = require('./handbrake');
const ffmpeg = require('./ffmpeg');
const utils = require('./utils');
const musicBrainz = require('./music_brainz');
const processHandler = require('./process_handler');
const logger = require('./logger');

module.exports = {
  main,
  armRipper,
  identify,
  makemkv,
  handbrake,
  ffmpeg,
  utils,
  musicBrainz,
  processHandler,
  logger,
};
