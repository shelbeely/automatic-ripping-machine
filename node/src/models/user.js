const { getDatabase } = require('./database');
const bcrypt = require('bcryptjs');

class User {
  constructor(data = {}) {
    this.user_id = data.user_id || null;
    this.email = data.email || '';
    this.password = data.password || '';
    this.hash = data.hash || '';
  }

  static async findById(id) {
    const db = getDatabase();
    const row = await db('user').where('user_id', id).first();
    return row ? new User(row) : null;
  }

  static async findByEmail(email) {
    const db = getDatabase();
    const row = await db('user').where('email', email).first();
    return row ? new User(row) : null;
  }

  async verifyPassword(password) {
    return bcrypt.compare(password, this.password);
  }

  static async hashPassword(password) {
    return bcrypt.hash(password, 12);
  }

  static async count() {
    const db = getDatabase();
    const result = await db('user').count('* as count').first();
    return result ? result.count : 0;
  }

  async save() {
    const db = getDatabase();
    const data = {
      email: this.email,
      password: this.password,
      hash: this.hash,
    };
    if (this.user_id) {
      await db('user').where('user_id', this.user_id).update(data);
    } else {
      const [id] = await db('user').insert(data);
      this.user_id = id;
    }
    return this;
  }
}

module.exports = { User };
