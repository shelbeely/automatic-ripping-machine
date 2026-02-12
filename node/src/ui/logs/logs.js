const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { Job } = require('../../models/job');
const { createLogger } = require('../../ripper/logger');

const logger = createLogger('logs');

router.get('/logs', async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.render('logs', { title: 'Logs', logContent: '', jobId: null });
    }
    const job = await Job.findById(jobId);
    if (!job || !job.logfile) {
      return res.render('logs', { title: 'Logs', logContent: 'No log file found', jobId });
    }
    let logContent = '';
    if (fs.existsSync(job.logfile)) {
      logContent = fs.readFileSync(job.logfile, 'utf8');
    } else {
      logContent = 'Log file not found on disk';
    }
    res.render('logs', { title: `Logs - Job ${jobId}`, logContent, jobId });
  } catch (err) {
    logger.error(`Logs error: ${err.message}`);
    res.status(500).render('error', { title: 'Error', error: err.message });
  }
});

module.exports = router;
