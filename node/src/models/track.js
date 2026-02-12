const { getDatabase } = require('./database');

class Track {
  constructor(data = {}) {
    this.track_id = data.track_id || null;
    this.job_id = data.job_id || null;
    this.track_number = data.track_number || 0;
    this.length = data.length || 0;
    this.aspect_ratio = data.aspect_ratio || '';
    this.fps = data.fps || 0;
    this.main_feature = data.main_feature || false;
    this.basename = data.basename || '';
    this.filename = data.filename || '';
    this.new_filename = data.new_filename || '';
    this.orig_filename = data.orig_filename || '';
    this.ripped = data.ripped || false;
    this.process = data.process !== undefined ? data.process : true;
    this.source = data.source || '';
  }

  toJSON() {
    return {
      track_id: this.track_id,
      job_id: this.job_id,
      track_number: this.track_number,
      length: this.length,
      aspect_ratio: this.aspect_ratio,
      fps: this.fps,
      main_feature: this.main_feature,
      basename: this.basename,
      filename: this.filename,
      new_filename: this.new_filename,
      orig_filename: this.orig_filename,
      ripped: this.ripped,
      process: this.process,
      source: this.source,
    };
  }

  static async findById(id) {
    const db = getDatabase();
    const row = await db('track').where('track_id', id).first();
    return row ? new Track(row) : null;
  }

  static async findByJobId(jobId) {
    const db = getDatabase();
    const rows = await db('track').where('job_id', jobId);
    return rows.map((row) => new Track(row));
  }

  async save() {
    const db = getDatabase();
    const data = this.toJSON();
    delete data.track_id;
    if (this.track_id) {
      await db('track').where('track_id', this.track_id).update(data);
    } else {
      const [id] = await db('track').insert(data);
      this.track_id = id;
    }
    return this;
  }

  async delete() {
    const db = getDatabase();
    if (this.track_id) {
      await db('track').where('track_id', this.track_id).del();
    }
  }
}

module.exports = { Track };
