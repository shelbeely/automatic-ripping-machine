const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const fs = require('fs');
const { Job, JobState } = require('../models/job');
const { Track } = require('../models/track');
const { Notification } = require('../models/notifications');
const { Config } = require('../models/config_model');
const { createLogger } = require('../ripper/logger');

const logger = createLogger('api');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, error: 'Too many requests' },
});
router.use(apiLimiter);

function percentage(part, whole) {
  if (!whole) return 0;
  return Math.round((100 * part) / whole);
}

// Get jobs by status
router.get('/jobs', async (req, res) => {
  try {
    const status = req.query.status;
    let jobs;
    if (status === 'active') {
      jobs = await Job.getActive();
    } else if (status) {
      jobs = await Job.findAll({ status: status.split(',') });
    } else {
      jobs = await Job.findAll();
    }
    res.json({ success: true, jobs: jobs.map((j) => j.toJSON()) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single job
router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    const tracks = await Track.findByJobId(req.params.id);
    res.json({ success: true, job: job.toJSON(), tracks: tracks.map((t) => t.toJSON()) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete job
router.delete('/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    await job.delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Abandon job
router.post('/jobs/:id/abandon', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.pid) {
      try {
        process.kill(job.pid);
      } catch (err) {
        // process may already be dead
      }
    }
    job.status = JobState.FAIL;
    job.stop_time = new Date().toISOString();
    await job.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Search
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const { getDatabase } = require('../models/database');
    const db = getDatabase();
    // Parameterized query to prevent SQL injection
    const jobs = await db('job').where('title', 'like', db.raw('?', [`%${query}%`])).orderBy('start_time', 'desc');
    res.json({ success: true, results: jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update job config
router.put('/config/:id', async (req, res) => {
  try {
    const config = await Config.findById(req.params.id);
    if (!config) return res.status(404).json({ success: false, error: 'Config not found' });
    Object.assign(config, req.body);
    await config.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Notifications
router.get('/notifications', async (req, res) => {
  try {
    const notifications = await Notification.findUnseen();
    res.json({ success: true, notifications: notifications.map((n) => n.toJSON()) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Read log file
router.get('/logs/:jobId', async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job || !job.logfile) {
      return res.status(404).json({ success: false, error: 'Log not found' });
    }
    const lines = req.query.lines ? parseInt(req.query.lines) : 20;
    if (!fs.existsSync(job.logfile)) {
      return res.json({ success: true, log: '' });
    }
    const content = fs.readFileSync(job.logfile, 'utf8');
    const allLines = content.split('\n');
    const lastLines = allLines.slice(-lines).join('\n');
    res.json({ success: true, log: lastLines });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// AI Agent: identify disc title from label
router.post('/ai/identify', async (req, res) => {
  try {
    const { label, disctype } = req.body;
    if (!label) {
      return res.status(400).json({ success: false, error: 'label is required' });
    }
    const { loadConfig } = require('../config/config');
    const { createAgent, parseDiscLabel } = require('../ripper/ai_agent');
    const config = loadConfig();
    const agent = createAgent(config);
    if (!agent) {
      return res.status(503).json({
        success: false,
        error: 'AI agent not configured. Set AI_API_KEY in arm.yaml or ARM_AI_API_KEY env var.',
      });
    }
    const result = await parseDiscLabel(agent, label, disctype || 'unknown');
    if (result) {
      res.json({ success: true, result });
    } else {
      res.json({ success: false, error: 'AI could not parse the label' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
