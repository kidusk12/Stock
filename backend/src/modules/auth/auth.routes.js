const express = require('express');
const controller = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

router.post('/login', controller.login);
router.get('/me', authenticate, controller.me);
router.post('/logout', authenticate, controller.logout);
router.post('/change-password', authenticate, controller.changePassword);

module.exports = router;