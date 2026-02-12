const express = require('express');
const router = express.Router();
const { Job } = require('../../models/job');
const { Track } = require('../../models/track');
const { Config } = require('../../models/config_model');
const { createLogger } = require('../../ripper/logger');

const logger = createLogger('jobs');

router.get('/jobdetail', async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).render('error', { title: 'Error', error: 'Job ID required' });
    }
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).render('error', { title: 'Error', error: 'Job not found' });
    }
    const tracks = await Track.findByJobId(jobId);
    const config = job.config_id ? await Config.findById(job.config_id) : null;
    res.render('jobdetail', { title: `Job ${jobId}`, job, tracks, config });
  } catch (err) {
    logger.error(`Job detail error: ${err.message}`);
    res.status(500).render('error', { title: 'Error', error: err.message });
  }
});

router.get('/activerips', async (req, res) => {
  try {
    const jobs = await Job.getActive();
    res.render('activerips', { title: 'Active Rips', jobs });
  } catch (err) {
    logger.error(`Active rips error: ${err.message}`);
    res.status(500).render('error', { title: 'Error', error: err.message });
  }
});

router.post('/updatetitle', async (req, res) => {
  try {
    const { job_id, title, year, video_type, imdb_id } = req.body;
    const job = await Job.findById(job_id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    if (title) { job.title = title; job.title_manual = title; }
    if (year) { job.year = year; job.year_manual = year; }
    if (video_type) { job.video_type = video_type; job.video_type_manual = video_type; }
    if (imdb_id) { job.imdb_id = imdb_id; job.imdb_id_manual = imdb_id; }
    job.hasnicetitle = true;
    await job.save();
    res.json({ success: true });
  } catch (err) {
    logger.error(`Update title error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
