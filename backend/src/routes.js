const express = require('express');
const { authenticate, blockAuditorWrites } = require('./middleware/auth');

const router = express.Router();

// --- public (no token needed) ---
router.get('/health', (req, res) => {
  res.json({ data: { status: 'ok' } });
});

// Auth routes: login is public; me, logout and change-password check the token themselves.
// They are mounted BEFORE the Auditor rule, so an Auditor can still log out and change password.
router.use('/auth', require('./modules/auth/auth.routes'));

// --- everything below needs a logged-in user, and an Auditor can never write (contract 1.3) ---
router.use(authenticate, blockAuditorWrites);

// Each feature registers its routes here when it is merged, for example:
router.use('/users', require('./modules/users/users.routes'));          // Kidus
const stockRoutes = require('./modules/stock/stock.routes');
router.use('/stock', stockRoutes);
router.use('/stock-movements', stockRoutes.movementsRouter);

module.exports = router;