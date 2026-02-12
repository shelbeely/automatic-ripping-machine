const express = require('express');
const router = express.Router();
const { getDatabase } = require('../../models/database');
const { createLogger } = require('../../ripper/logger');

const logger = createLogger('database');

router.get('/database', async (req, res) => {
  try {
    const db = getDatabase();
    const tables = await db.raw("SELECT name FROM sqlite_master WHERE type='table'");
    res.render('database', { title: 'Database', tables });
  } catch (err) {
    logger.error(`Database error: ${err.message}`);
    res.status(500).render('error', { title: 'Error', error: err.message });
  }
});

module.exports = router;
