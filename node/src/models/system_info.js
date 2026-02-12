const { getDatabase } = require('./database');
const os = require('os');

class SystemInfo {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || 'ARM Server';
    this.description = data.description || 'Automatic Ripping Machine main server';
    this.cpu = data.cpu || '';
    this.mem_total = data.mem_total || 0;
  }

  getCpuInfo() {
    const cpus = os.cpus();
    this.cpu = cpus.length > 0 ? cpus[0].model : 'Unknown';
    return this.cpu;
  }

  getMemory() {
    this.mem_total = parseFloat((os.totalmem() / (1024 * 1024 * 1024)).toFixed(2));
    return this.mem_total;
  }

  static async get() {
    const db = getDatabase();
    let row = await db('system_info').first();
    if (!row) {
      const info = new SystemInfo();
      info.getCpuInfo();
      info.getMemory();
      await info.save();
      return info;
    }
    return new SystemInfo(row);
  }

  async save() {
    const db = getDatabase();
    const data = {
      name: this.name,
      description: this.description,
      cpu: this.cpu,
      mem_total: this.mem_total,
    };
    if (this.id) {
      await db('system_info').where('id', this.id).update(data);
    } else {
      const [id] = await db('system_info').insert(data);
      this.id = id;
    }
    return this;
  }
}

module.exports = { SystemInfo };
