const { getDatabase } = require('./database');

class Config {
  constructor(data = {}) {
    this.config_id = data.config_id || null;
    this.SKIP_TRANSCODE = data.SKIP_TRANSCODE || false;
    this.RIPMETHOD = data.RIPMETHOD || 'mkv';
    this.MAINFEATURE = data.MAINFEATURE || false;
    this.MINLENGTH = data.MINLENGTH || 600;
    this.MAXLENGTH = data.MAXLENGTH || 99999;
    this.RAW_PATH = data.RAW_PATH || '';
    this.TRANSCODE_PATH = data.TRANSCODE_PATH || '';
    this.COMPLETED_PATH = data.COMPLETED_PATH || '';
    this.LOGPATH = data.LOGPATH || '';
    this.HB_PRESET_DVD = data.HB_PRESET_DVD || '';
    this.HB_PRESET_BD = data.HB_PRESET_BD || '';
    this.HB_ARGS_DVD = data.HB_ARGS_DVD || '';
    this.HB_ARGS_BD = data.HB_ARGS_BD || '';
    this.DEST_EXT = data.DEST_EXT || 'mkv';
    this.HANDBRAKE_CLI = data.HANDBRAKE_CLI || false;
    this.EMBY_SERVER = data.EMBY_SERVER || '';
    this.EMBY_PORT = data.EMBY_PORT || 0;
    this.EMBY_API_KEY = data.EMBY_API_KEY || '';
    this.EMBY_REFRESH = data.EMBY_REFRESH || false;
    this.NOTIFY_RIP = data.NOTIFY_RIP || false;
    this.NOTIFY_TRANSCODE = data.NOTIFY_TRANSCODE || false;
    this.PB_KEY = data.PB_KEY || '';
    this.IFTTT_KEY = data.IFTTT_KEY || '';
    this.IFTTT_EVENT = data.IFTTT_EVENT || '';
    this.PO_USER_KEY = data.PO_USER_KEY || '';
    this.PO_APP_KEY = data.PO_APP_KEY || '';
    this.JSON_URL = data.JSON_URL || '';
    this.OMDB_API_KEY = data.OMDB_API_KEY || '';
    this.TMDB_API_KEY = data.TMDB_API_KEY || '';
    this.USE_FFMPEG = data.USE_FFMPEG || false;
    this.FFMPEG_ARGS_DVD = data.FFMPEG_ARGS_DVD || '';
    this.FFMPEG_ARGS_BD = data.FFMPEG_ARGS_BD || '';
    this.FFMPEG_PRE_ARGS_DVD = data.FFMPEG_PRE_ARGS_DVD || '';
    this.FFMPEG_PRE_ARGS_BD = data.FFMPEG_PRE_ARGS_BD || '';
    this.MAX_CONCURRENT_TRANSCODES = data.MAX_CONCURRENT_TRANSCODES || 1;
    this.DATE_ADDED_TO_TITLE = data.DATE_ADDED_TO_TITLE || false;
  }

  toJSON() {
    const data = { ...this };
    return data;
  }

  static async findById(id) {
    const db = getDatabase();
    const row = await db('config').where('config_id', id).first();
    return row ? new Config(row) : null;
  }

  async save() {
    const db = getDatabase();
    const data = this.toJSON();
    delete data.config_id;
    if (this.config_id) {
      await db('config').where('config_id', this.config_id).update(data);
    } else {
      const [id] = await db('config').insert(data);
      this.config_id = id;
    }
    return this;
  }
}

module.exports = { Config };
