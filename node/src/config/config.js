const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DEFAULT_CONFIG_PATH = '/etc/arm/config/arm.yaml';
const DEFAULT_APPRISE_PATH = '/etc/arm/config/apprise.yaml';
const DEFAULT_ABCDE_PATH = '/etc/arm/config/.abcde.conf';

function loadConfig(filePath = DEFAULT_CONFIG_PATH) {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return yaml.load(fileContents) || {};
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`Config file not found: ${filePath}, using defaults`);
      return {};
    }
    throw err;
  }
}

function loadAbcdeConfig(filePath = DEFAULT_ABCDE_PATH) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return '';
    }
    throw err;
  }
}

function loadAppriseConfig(filePath = DEFAULT_APPRISE_PATH) {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return yaml.load(fileContents) || {};
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

// Attempt to load config at module load time
let armConfig = {};
let abcdeConfig = '';
let appriseConfig = {};

try {
  armConfig = loadConfig();
} catch (e) {
  console.warn('Failed to load ARM config:', e.message);
}

try {
  abcdeConfig = loadAbcdeConfig();
} catch (e) {
  console.warn('Failed to load ABCDE config:', e.message);
}

try {
  appriseConfig = loadAppriseConfig();
} catch (e) {
  console.warn('Failed to load Apprise config:', e.message);
}

module.exports = {
  loadConfig,
  loadAbcdeConfig,
  loadAppriseConfig,
  armConfig,
  abcdeConfig,
  appriseConfig,
  DEFAULT_CONFIG_PATH,
  DEFAULT_APPRISE_PATH,
  DEFAULT_ABCDE_PATH,
};
