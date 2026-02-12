const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { User } = require('../../models/user');
const { createLogger } = require('../../ripper/logger');

const logger = createLogger('auth');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many attempts, please try again later',
});

function requireAuth(req, res, next) {
  if (req.session.user) {
    return next();
  }
  if (req.accepts('json')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  res.redirect('/login');
}

router.get('/login', (req, res) => {
  res.render('login', { title: 'Login', error: null });
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user) {
      return res.render('login', { title: 'Login', error: 'Invalid credentials' });
    }
    const valid = await user.verifyPassword(password);
    if (!valid) {
      return res.render('login', { title: 'Login', error: 'Invalid credentials' });
    }
    req.session.user = { user_id: user.user_id, email: user.email };
    res.redirect('/');
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    res.render('login', { title: 'Login', error: 'An error occurred' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

router.get('/update_password', requireAuth, (req, res) => {
  res.render('update_password', { title: 'Update Password', error: null, success: null });
});

router.post('/update_password', requireAuth, authLimiter, async (req, res) => {
  try {
    const { old_password, new_password, confirm_password } = req.body;
    if (new_password !== confirm_password) {
      return res.render('update_password', {
        title: 'Update Password', error: 'Passwords do not match', success: null,
      });
    }
    const user = await User.findById(req.session.user.user_id);
    const valid = await user.verifyPassword(old_password);
    if (!valid) {
      return res.render('update_password', {
        title: 'Update Password', error: 'Current password is incorrect', success: null,
      });
    }
    user.password = await User.hashPassword(new_password);
    await user.save();
    res.render('update_password', {
      title: 'Update Password', error: null, success: 'Password updated successfully',
    });
  } catch (err) {
    logger.error(`Password update error: ${err.message}`);
    res.render('update_password', {
      title: 'Update Password', error: 'An error occurred', success: null,
    });
  }
});

module.exports = router;
module.exports.requireAuth = requireAuth;
