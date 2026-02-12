const express = require('express');
const router = express.Router();
const { Job, JobState } = require('../../models/job');
const { createLogger } = require('../../ripper/logger');

const logger = createLogger('history');

router.get('/history', async (req, res) => {
  try {
    const jobs = await Job.findAll({
      status: [JobState.SUCCESS, JobState.FAIL],
    });
    res.render('history', { title: 'History', jobs });
  } catch (err) {
    logger.error(`History error: ${err.message}`);
    res.status(500).render('error', { title: 'Error', error: err.message });
  }
});

module.exports = router;
