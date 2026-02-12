const express = require('express');
const router = express.Router();
const { Notification } = require('../../models/notifications');
const { createLogger } = require('../../ripper/logger');

const logger = createLogger('notifications');

router.get('/notifications', async (req, res) => {
  try {
    const notifications = await Notification.findAll();
    res.render('notifications', { title: 'Notifications', notifications });
  } catch (err) {
    logger.error(`Notifications error: ${err.message}`);
    res.status(500).render('error', { title: 'Error', error: err.message });
  }
});

router.post('/notification/read/:id', async (req, res) => {
  try {
    await Notification.markRead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/notification/clear', async (req, res) => {
  try {
    await Notification.clearAll();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
