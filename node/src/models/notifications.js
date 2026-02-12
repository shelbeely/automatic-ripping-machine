const { getDatabase } = require('./database');

class Notification {
  constructor(data = {}) {
    this.id = data.id || null;
    this.title = data.title || '';
    this.message = data.message || '';
    this.seen = data.seen || false;
    this.trigger_time = data.trigger_time || new Date().toISOString();
    this.dismiss_time = data.dismiss_time || null;
    this.cleared = data.cleared || false;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      message: this.message,
      seen: this.seen,
      trigger_time: this.trigger_time,
      dismiss_time: this.dismiss_time,
      cleared: this.cleared,
    };
  }

  static async findUnseen() {
    const db = getDatabase();
    const rows = await db('notifications').where('seen', false);
    return rows.map((row) => new Notification(row));
  }

  static async findAll() {
    const db = getDatabase();
    const rows = await db('notifications').orderBy('trigger_time', 'desc');
    return rows.map((row) => new Notification(row));
  }

  async save() {
    const db = getDatabase();
    const data = this.toJSON();
    delete data.id;
    if (this.id) {
      await db('notifications').where('id', this.id).update(data);
    } else {
      const [id] = await db('notifications').insert(data);
      this.id = id;
    }
    return this;
  }

  static async markRead(id) {
    const db = getDatabase();
    await db('notifications').where('id', id).update({
      seen: true,
      dismiss_time: new Date().toISOString(),
    });
  }

  static async clearAll() {
    const db = getDatabase();
    await db('notifications').update({
      seen: true,
      cleared: true,
      dismiss_time: new Date().toISOString(),
    });
  }
}

module.exports = { Notification };
