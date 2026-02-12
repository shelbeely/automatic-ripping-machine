const express = require('express');
const router = express.Router();
const { SystemDrives } = require('../../models/system_drives');
const { SystemInfo } = require('../../models/system_info');
const { loadConfig } = require('../../config/config');
const { createLogger } = require('../../ripper/logger');
const os = require('os');

const logger = createLogger('settings');

router.get('/settings', async (req, res) => {
  try {
    const config = loadConfig();
    const drives = await SystemDrives.findAll();
    res.render('settings', { title: 'Settings', config, drives });
  } catch (err) {
    logger.error(`Settings error: ${err.message}`);
    res.status(500).render('error', { title: 'Error', error: err.message });
  }
});

router.post('/save_settings', async (req, res) => {
  try {
    const fs = require('fs');
    const yaml = require('js-yaml');
    const { DEFAULT_CONFIG_PATH, loadConfig } = require('../../config/config');
    const currentConfig = loadConfig();
    const allowedKeys = Object.keys(currentConfig);
    const config = {};
    // Only accept keys that exist in the current configuration
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        config[key] = req.body[key];
      } else {
        config[key] = currentConfig[key];
      }
    }
    const yamlStr = yaml.dump(config);
    fs.writeFileSync(DEFAULT_CONFIG_PATH, yamlStr);
    res.json({ success: true, message: 'Settings saved' });
  } catch (err) {
    logger.error(`Save settings error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/systeminfo', async (req, res) => {
  try {
    const systemInfo = await SystemInfo.get();
    const drives = await SystemDrives.findAll();
    res.render('systeminfo', {
      title: 'System Info',
      systemInfo,
      drives,
      uptime: os.uptime(),
      platform: os.platform(),
      hostname: os.hostname(),
    });
  } catch (err) {
    logger.error(`System info error: ${err.message}`);
    res.status(500).render('error', { title: 'Error', error: err.message });
  }
});

router.post('/drive/eject/:id', async (req, res) => {
  try {
    const drive = await SystemDrives.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, error: 'Drive not found' });
    }
    drive.eject();
    await drive.save();
    res.json({ success: true });
  } catch (err) {
    logger.error(`Eject error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
