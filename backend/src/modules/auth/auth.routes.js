const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const controller = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

const tooMany = {
  error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many login attempts. Try again later.' },
};

// Limiter 1: max 5 FAILED logins per username per 15 minutes (contract N9).
// Successful logins are not counted. Off under Jest (NODE_ENV=test).
// Falls back to the IP address when no username is sent.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => {
    const username =
      req.body && typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    return username ? `user:${username}` : `ip:${ipKeyGenerator(req.ip)}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
});

// Limiter 2: max 30 FAILED logins per IP address per 15 minutes.
// Stops one machine from trying many usernames. The limit is high so that
// staff sharing one office IP are not affected by a few typos.
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
});

router.post('/login', loginIpLimiter, loginLimiter, controller.login);
router.get('/me', authenticate, controller.me);
router.post('/logout', authenticate, controller.logout);
router.post('/change-password', authenticate, controller.changePassword);

module.exports = router;