const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { getDatabase } = require('../../models/database');
const { createLogger } = require('../../ripper/logger');

const logger = createLogger('database');

const dbLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests',
});

router.get('/database', dbLimiter, async (req, res) => {
  try {
    const db = getDatabase();
    const tables = await db.raw("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'knex_%' ORDER BY name");
    const tableInfo = [];
    for (const t of tables) {
      try {
        const countResult = await db(t.name).count('* as count').first();
        tableInfo.push({ name: t.name, count: countResult ? countResult.count : 0 });
      } catch (err) {
        tableInfo.push({ name: t.name, count: '?' });
      }
    }
    const selectedTable = req.query.table || '';
    let rows = [];
    let columns = [];
    if (selectedTable) {
      // Validate against actual table list to prevent SQL injection
      const validTable = tableInfo.find((t) => t.name === selectedTable);
      if (validTable) {
        rows = await db(validTable.name).orderBy(1, 'desc').limit(100);
        if (rows.length > 0) {
          columns = Object.keys(rows[0]);
        }
      }
    }
    res.render('database', { title: 'Database', tables: tableInfo, selectedTable, rows, columns });
  } catch (err) {
    logger.error(`Database error: ${err.message}`);
    res.status(500).render('error', { title: 'Error', error: err.message });
  }
});

module.exports = router;
