const express = require('express');
const router = express.Router();

// Placeholder - media distribution feature
router.get('/send', (req, res) => {
  res.render('send', { title: 'Send Media' });
});

module.exports = router;
