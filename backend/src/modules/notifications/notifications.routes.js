const express = require('express');
const controller = require('./notifications.controller');
const { requireRole } = require('../../middleware/auth');

const router = express.Router();

const notificationReaders = ['ADMIN', 'BRANCH_MANAGER'];

// GET /api/notifications
router.get(
  '/',
  requireRole(...notificationReaders),
  controller.list
);

// Keep this route explicit and readable.
router.post(
  '/read-all',
  requireRole(...notificationReaders),
  controller.markAllRead
);

// POST /api/notifications/:id/read
router.post(
  '/:id/read',
  requireRole(...notificationReaders),
  controller.markRead
);

module.exports = router;