const path = require('path');
const knex = require('knex');

const DEFAULT_DB_PATH = path.join('/home', 'arm', 'db', 'arm.db');

let db = null;

function getDatabase(dbPath = DEFAULT_DB_PATH) {
  if (db) return db;
  db = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath,
    },
    useNullAsDefault: true,
  });
  return db;
}

async function initializeDatabase(dbPath = DEFAULT_DB_PATH) {
  const database = getDatabase(dbPath);

  // Create tables if they don't exist
  const hasJob = await database.schema.hasTable('job');
  if (!hasJob) {
    await database.schema.createTable('job', (table) => {
      table.increments('job_id').primary();
      table.string('arm_version');
      table.string('crc_id');
      table.string('logfile');
      table.datetime('start_time');
      table.datetime('stop_time');
      table.string('job_length');
      table.string('status').defaultTo('active');
      table.string('stage');
      table.string('progress');
      table.string('progress_round');
      table.string('eta');
      table.string('title').defaultTo('');
      table.string('title_auto');
      table.string('title_manual');
      table.string('year').defaultTo('');
      table.string('year_auto');
      table.string('year_manual');
      table.string('video_type').defaultTo('');
      table.string('video_type_auto');
      table.string('video_type_manual');
      table.string('imdb_id').defaultTo('');
      table.string('imdb_id_auto');
      table.string('imdb_id_manual');
      table.string('poster_url').defaultTo('');
      table.string('poster_url_auto');
      table.string('poster_url_manual');
      table.string('devpath');
      table.string('mountpoint');
      table.string('label');
      table.string('disctype').defaultTo('unknown');
      table.boolean('hasnicetitle').defaultTo(false);
      table.boolean('no_of_titles');
      table.string('path');
      table.integer('config_id');
      table.integer('drive_id');
      table.text('errors');
      table.integer('pid');
      table.integer('pid_hash');
      table.text('process_log');
    });
  }

  const hasTrack = await database.schema.hasTable('track');
  if (!hasTrack) {
    await database.schema.createTable('track', (table) => {
      table.increments('track_id').primary();
      table.integer('job_id').references('job_id').inTable('job');
      table.integer('track_number');
      table.integer('length');
      table.string('aspect_ratio');
      table.float('fps');
      table.boolean('main_feature').defaultTo(false);
      table.string('basename');
      table.string('filename');
      table.string('new_filename');
      table.string('orig_filename');
      table.boolean('ripped').defaultTo(false);
      table.boolean('process').defaultTo(true);
      table.string('source');
    });
  }

  const hasConfig = await database.schema.hasTable('config');
  if (!hasConfig) {
    await database.schema.createTable('config', (table) => {
      table.increments('config_id').primary();
      table.boolean('SKIP_TRANSCODE').defaultTo(false);
      table.string('RIPMETHOD').defaultTo('mkv');
      table.boolean('MAINFEATURE').defaultTo(false);
      table.integer('MINLENGTH').defaultTo(600);
      table.integer('MAXLENGTH').defaultTo(99999);
      table.string('RAW_PATH');
      table.string('TRANSCODE_PATH');
      table.string('COMPLETED_PATH');
      table.string('LOGPATH');
      table.string('HB_PRESET_DVD');
      table.string('HB_PRESET_BD');
      table.string('HB_ARGS_DVD');
      table.string('HB_ARGS_BD');
      table.string('DEST_EXT').defaultTo('mkv');
      table.boolean('HANDBRAKE_CLI').defaultTo(false);
      table.string('EMBY_SERVER');
      table.integer('EMBY_PORT');
      table.string('EMBY_API_KEY');
      table.boolean('EMBY_REFRESH').defaultTo(false);
      table.boolean('NOTIFY_RIP').defaultTo(false);
      table.boolean('NOTIFY_TRANSCODE').defaultTo(false);
      table.string('PB_KEY');
      table.string('IFTTT_KEY');
      table.string('IFTTT_EVENT');
      table.string('PO_USER_KEY');
      table.string('PO_APP_KEY');
      table.string('JSON_URL');
      table.string('OMDB_API_KEY');
      table.string('TMDB_API_KEY');
      table.boolean('USE_FFMPEG').defaultTo(false);
      table.string('FFMPEG_ARGS_DVD');
      table.string('FFMPEG_ARGS_BD');
      table.string('FFMPEG_PRE_ARGS_DVD');
      table.string('FFMPEG_PRE_ARGS_BD');
      table.integer('MAX_CONCURRENT_TRANSCODES').defaultTo(1);
      table.boolean('DATE_ADDED_TO_TITLE').defaultTo(false);
    });
  }

  const hasUser = await database.schema.hasTable('user');
  if (!hasUser) {
    await database.schema.createTable('user', (table) => {
      table.increments('user_id').primary();
      table.string('email').notNullable();
      table.string('password');
      table.string('hash');
    });
  }

  const hasSystemDrives = await database.schema.hasTable('system_drives');
  if (!hasSystemDrives) {
    await database.schema.createTable('system_drives', (table) => {
      table.increments('drive_id').primary();
      table.string('name');
      table.string('type');
      table.string('mount');
      table.boolean('open').defaultTo(false);
      table.string('job_id_current');
      table.string('model');
      table.string('serial_id');
      table.string('drive_mode').defaultTo('automatic');
      table.string('description');
    });
  }

  const hasNotifications = await database.schema.hasTable('notifications');
  if (!hasNotifications) {
    await database.schema.createTable('notifications', (table) => {
      table.increments('id').primary();
      table.string('title');
      table.text('message');
      table.boolean('seen').defaultTo(false);
      table.datetime('trigger_time').defaultTo(database.fn.now());
      table.datetime('dismiss_time');
      table.boolean('cleared').defaultTo(false);
    });
  }

  const hasSystemInfo = await database.schema.hasTable('system_info');
  if (!hasSystemInfo) {
    await database.schema.createTable('system_info', (table) => {
      table.increments('id').primary();
      table.string('name').defaultTo('ARM Server');
      table.string('description').defaultTo('Automatic Ripping Machine main server');
      table.string('cpu');
      table.float('mem_total');
    });
  }

  return database;
}

function closeDatabase() {
  if (db) {
    db.destroy();
    db = null;
  }
}

module.exports = {
  getDatabase,
  initializeDatabase,
  closeDatabase,
  DEFAULT_DB_PATH,
};
