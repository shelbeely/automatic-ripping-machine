const { getDatabase } = require('./database');
const { execSync } = require('child_process');

const CDS = {
  NO_INFO: 0,
  NO_DISC: 1,
  TRAY_OPEN: 2,
  NOT_READY: 3,
  DISC_OK: 4,
};

class SystemDrives {
  constructor(data = {}) {
    this.drive_id = data.drive_id || null;
    this.name = data.name || '';
    this.type = data.type || '';
    this.mount = data.mount || '';
    this.open = data.open || false;
    this.job_id_current = data.job_id_current || null;
    this.model = data.model || '';
    this.serial_id = data.serial_id || '';
    this.drive_mode = data.drive_mode || 'automatic';
    this.description = data.description || '';
  }

  static async findById(id) {
    const db = getDatabase();
    const row = await db('system_drives').where('drive_id', id).first();
    return row ? new SystemDrives(row) : null;
  }

  static async findAll() {
    const db = getDatabase();
    const rows = await db('system_drives');
    return rows.map((row) => new SystemDrives(row));
  }

  static async findByMount(mount) {
    const db = getDatabase();
    const row = await db('system_drives').where('mount', mount).first();
    return row ? new SystemDrives(row) : null;
  }

  eject() {
    try {
      execSync(`eject ${this.mount}`);
      this.open = true;
    } catch (err) {
      console.error(`Failed to eject ${this.mount}:`, err.message);
    }
  }

  closeTray() {
    try {
      execSync(`eject -t ${this.mount}`);
      this.open = false;
    } catch (err) {
      console.error(`Failed to close tray ${this.mount}:`, err.message);
    }
  }

  async save() {
    const db = getDatabase();
    const data = {
      name: this.name,
      type: this.type,
      mount: this.mount,
      open: this.open,
      job_id_current: this.job_id_current,
      model: this.model,
      serial_id: this.serial_id,
      drive_mode: this.drive_mode,
      description: this.description,
    };
    if (this.drive_id) {
      await db('system_drives').where('drive_id', this.drive_id).update(data);
    } else {
      const [id] = await db('system_drives').insert(data);
      this.drive_id = id;
    }
    return this;
  }
}

module.exports = { SystemDrives, CDS };
