const path = require('path');
const { initializeDatabase, closeDatabase, getDatabase } = require('../src/models/database');
const { Job, JobState } = require('../src/models/job');
const { Track } = require('../src/models/track');
const { Config } = require('../src/models/config_model');
const { User } = require('../src/models/user');
const { Notification } = require('../src/models/notifications');
const { SystemInfo } = require('../src/models/system_info');

const TEST_DB = path.join(__dirname, 'test_models.db');

beforeAll(async () => {
  await initializeDatabase(TEST_DB);
});

afterAll(async () => {
  closeDatabase();
  const fs = require('fs');
  try { fs.unlinkSync(TEST_DB); } catch (e) {}
});

describe('Job Model', () => {
  test('should create a new job', async () => {
    const job = new Job({
      title: 'Test Movie',
      devpath: '/dev/sr0',
      status: JobState.ACTIVE,
      disctype: 'dvd',
    });
    await job.save();
    expect(job.job_id).toBeDefined();
    expect(job.job_id).toBeGreaterThan(0);
  });

  test('should find job by ID', async () => {
    const job = new Job({
      title: 'Find Me',
      devpath: '/dev/sr1',
      status: JobState.RIPPING,
    });
    await job.save();
    const found = await Job.findById(job.job_id);
    expect(found).not.toBeNull();
    expect(found.title).toBe('Find Me');
    expect(found.status).toBe(JobState.RIPPING);
  });

  test('should update job', async () => {
    const job = new Job({ title: 'Update Me', devpath: '/dev/sr0' });
    await job.save();
    job.title = 'Updated Title';
    job.status = JobState.SUCCESS;
    await job.save();
    const found = await Job.findById(job.job_id);
    expect(found.title).toBe('Updated Title');
    expect(found.status).toBe(JobState.SUCCESS);
  });

  test('should get active jobs', async () => {
    const activeJob = new Job({ title: 'Active', status: JobState.RIPPING });
    await activeJob.save();
    const activeJobs = await Job.getActive();
    expect(activeJobs.length).toBeGreaterThan(0);
    const titles = activeJobs.map(j => j.title);
    expect(titles).toContain('Active');
  });

  test('should correctly compute isFinished', () => {
    const successJob = new Job({ status: JobState.SUCCESS });
    expect(successJob.isFinished).toBe(true);
    const failJob = new Job({ status: JobState.FAIL });
    expect(failJob.isFinished).toBe(true);
    const activeJob = new Job({ status: JobState.RIPPING });
    expect(activeJob.isFinished).toBe(false);
  });

  test('should correctly compute isRipping', () => {
    const rippingJob = new Job({ status: JobState.RIPPING });
    expect(rippingJob.isRipping).toBe(true);
    const transcodingJob = new Job({ status: JobState.TRANSCODING });
    expect(transcodingJob.isRipping).toBe(false);
  });

  test('should delete job', async () => {
    const job = new Job({ title: 'Delete Me' });
    await job.save();
    const id = job.job_id;
    await job.delete();
    const found = await Job.findById(id);
    expect(found).toBeNull();
  });

  test('toJSON returns all fields', () => {
    const job = new Job({ title: 'JSON Test', disctype: 'bluray', year: '2024' });
    const json = job.toJSON();
    expect(json.title).toBe('JSON Test');
    expect(json.disctype).toBe('bluray');
    expect(json.year).toBe('2024');
    expect(json).toHaveProperty('job_id');
    expect(json).toHaveProperty('status');
  });
});

describe('Track Model', () => {
  let testJobId;

  beforeAll(async () => {
    const job = new Job({ title: 'Track Test Job' });
    await job.save();
    testJobId = job.job_id;
  });

  test('should create a track', async () => {
    const track = new Track({
      job_id: testJobId,
      track_number: 1,
      length: 7200,
      main_feature: true,
      filename: 'title_t01.mkv',
    });
    await track.save();
    expect(track.track_id).toBeDefined();
  });

  test('should find tracks by job ID', async () => {
    const track = new Track({
      job_id: testJobId,
      track_number: 2,
      length: 300,
      filename: 'title_t02.mkv',
    });
    await track.save();
    const tracks = await Track.findByJobId(testJobId);
    expect(tracks.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Config Model', () => {
  test('should create and retrieve config', async () => {
    const config = new Config({
      RIPMETHOD: 'mkv',
      MAINFEATURE: true,
      MINLENGTH: 600,
      MAXLENGTH: 99999,
    });
    await config.save();
    expect(config.config_id).toBeDefined();

    const found = await Config.findById(config.config_id);
    expect(found.RIPMETHOD).toBe('mkv');
    expect(found.MAINFEATURE).toBeTruthy();
  });
});

describe('User Model', () => {
  test('should create user with hashed password', async () => {
    const hashedPw = await User.hashPassword('testpass123');
    const user = new User({
      email: 'test@example.com',
      password: hashedPw,
    });
    await user.save();
    expect(user.user_id).toBeDefined();
  });

  test('should verify correct password', async () => {
    const hashedPw = await User.hashPassword('mypassword');
    const user = new User({
      email: 'verify@test.com',
      password: hashedPw,
    });
    await user.save();

    const found = await User.findByEmail('verify@test.com');
    expect(found).not.toBeNull();
    const valid = await found.verifyPassword('mypassword');
    expect(valid).toBe(true);
  });

  test('should reject incorrect password', async () => {
    const found = await User.findByEmail('verify@test.com');
    const valid = await found.verifyPassword('wrongpassword');
    expect(valid).toBe(false);
  });
});

describe('Notification Model', () => {
  test('should create notification', async () => {
    const notif = new Notification({
      title: 'Test Notification',
      message: 'This is a test',
    });
    await notif.save();
    expect(notif.id).toBeDefined();
  });

  test('should find unseen notifications', async () => {
    const unseen = await Notification.findUnseen();
    expect(unseen.length).toBeGreaterThan(0);
  });

  test('should mark notification as read', async () => {
    const notif = new Notification({
      title: 'Mark Me Read',
      message: 'Test',
    });
    await notif.save();
    await Notification.markRead(notif.id);
    const unseen = await Notification.findUnseen();
    const found = unseen.find(n => n.id === notif.id);
    expect(found).toBeUndefined();
  });
});

describe('SystemInfo Model', () => {
  test('should get CPU info', () => {
    const info = new SystemInfo();
    const cpu = info.getCpuInfo();
    expect(cpu).toBeTruthy();
  });

  test('should get memory info', () => {
    const info = new SystemInfo();
    const mem = info.getMemory();
    expect(mem).toBeGreaterThan(0);
  });
});
