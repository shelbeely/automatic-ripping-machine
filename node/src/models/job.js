const { getDatabase } = require('./database');

const JobState = {
  NONE: 'none',
  ACTIVE: 'active',
  RIPPING: 'ripping',
  RIPPING_FAIL: 'ripping_fail',
  TRANSCODING: 'transcoding',
  TRANSCODING_FAIL: 'transcoding_fail',
  SUCCESS: 'success',
  FAIL: 'fail',
  EJECTED: 'ejected',
};

class Job {
  constructor(data = {}) {
    this.job_id = data.job_id || null;
    this.arm_version = data.arm_version || '';
    this.crc_id = data.crc_id || '';
    this.logfile = data.logfile || '';
    this.start_time = data.start_time || new Date().toISOString();
    this.stop_time = data.stop_time || null;
    this.job_length = data.job_length || '';
    this.status = data.status || JobState.ACTIVE;
    this.stage = data.stage || '';
    this.progress = data.progress || '';
    this.progress_round = data.progress_round || '';
    this.eta = data.eta || '';
    this.title = data.title || '';
    this.title_auto = data.title_auto || '';
    this.title_manual = data.title_manual || '';
    this.year = data.year || '';
    this.year_auto = data.year_auto || '';
    this.year_manual = data.year_manual || '';
    this.video_type = data.video_type || '';
    this.video_type_auto = data.video_type_auto || '';
    this.video_type_manual = data.video_type_manual || '';
    this.imdb_id = data.imdb_id || '';
    this.imdb_id_auto = data.imdb_id_auto || '';
    this.imdb_id_manual = data.imdb_id_manual || '';
    this.poster_url = data.poster_url || '';
    this.poster_url_auto = data.poster_url_auto || '';
    this.poster_url_manual = data.poster_url_manual || '';
    this.devpath = data.devpath || '';
    this.mountpoint = data.mountpoint || '';
    this.label = data.label || '';
    this.disctype = data.disctype || 'unknown';
    this.hasnicetitle = data.hasnicetitle || false;
    this.no_of_titles = data.no_of_titles || null;
    this.path = data.path || '';
    this.config_id = data.config_id || null;
    this.drive_id = data.drive_id || null;
    this.errors = data.errors || '';
    this.pid = data.pid || null;
    this.pid_hash = data.pid_hash || null;
    this.process_log = data.process_log || '';
  }

  get isFinished() {
    return [JobState.SUCCESS, JobState.FAIL, JobState.EJECTED].includes(this.status);
  }

  get isActive() {
    return !this.isFinished;
  }

  get isRipping() {
    return [JobState.RIPPING, JobState.RIPPING_FAIL].includes(this.status);
  }

  get isTranscoding() {
    return [JobState.TRANSCODING, JobState.TRANSCODING_FAIL].includes(this.status);
  }

  toJSON() {
    return {
      job_id: this.job_id,
      arm_version: this.arm_version,
      crc_id: this.crc_id,
      logfile: this.logfile,
      start_time: this.start_time,
      stop_time: this.stop_time,
      job_length: this.job_length,
      status: this.status,
      stage: this.stage,
      progress: this.progress,
      progress_round: this.progress_round,
      eta: this.eta,
      title: this.title,
      title_auto: this.title_auto,
      title_manual: this.title_manual,
      year: this.year,
      year_auto: this.year_auto,
      year_manual: this.year_manual,
      video_type: this.video_type,
      video_type_auto: this.video_type_auto,
      video_type_manual: this.video_type_manual,
      imdb_id: this.imdb_id,
      imdb_id_auto: this.imdb_id_auto,
      imdb_id_manual: this.imdb_id_manual,
      poster_url: this.poster_url,
      poster_url_auto: this.poster_url_auto,
      poster_url_manual: this.poster_url_manual,
      devpath: this.devpath,
      mountpoint: this.mountpoint,
      label: this.label,
      disctype: this.disctype,
      hasnicetitle: this.hasnicetitle,
      no_of_titles: this.no_of_titles,
      path: this.path,
      config_id: this.config_id,
      drive_id: this.drive_id,
      errors: this.errors,
      pid: this.pid,
      pid_hash: this.pid_hash,
      process_log: this.process_log,
    };
  }

  // Static database methods
  static async findById(id) {
    const db = getDatabase();
    const row = await db('job').where('job_id', id).first();
    return row ? new Job(row) : null;
  }

  static async findAll(filters = {}) {
    const db = getDatabase();
    let query = db('job');
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.whereIn('status', filters.status);
      } else {
        query = query.where('status', filters.status);
      }
    }
    if (filters.notStatus) {
      if (Array.isArray(filters.notStatus)) {
        query = query.whereNotIn('status', filters.notStatus);
      } else {
        query = query.whereNot('status', filters.notStatus);
      }
    }
    const rows = await query.orderBy('start_time', 'desc');
    return rows.map((row) => new Job(row));
  }

  static async getActive() {
    return Job.findAll({
      notStatus: [JobState.SUCCESS, JobState.FAIL],
    });
  }

  async save() {
    const db = getDatabase();
    const data = this.toJSON();
    delete data.job_id;
    if (this.job_id) {
      await db('job').where('job_id', this.job_id).update(data);
    } else {
      const [id] = await db('job').insert(data);
      this.job_id = id;
    }
    return this;
  }

  async delete() {
    const db = getDatabase();
    if (this.job_id) {
      await db('job').where('job_id', this.job_id).del();
    }
  }
}

module.exports = { Job, JobState };
