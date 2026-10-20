const express = require('express');
const { authenticate, blockAuditorWrites } = require('./middleware/auth');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', require('./modules/auth/auth.routes'));

router.use(authenticate, blockAuditorWrites);

router.use('/users', require('./modules/users/users.routes'));
const stockRoutes = require('./modules/stock/stock.routes');
router.use('/stock', stockRoutes);
router.use('/stock-movements', stockRoutes.movementsRouter);
router.use('/sales', require('./modules/sales/sales.routes'));
router.use('/categories', require('./modules/categories/categories.routes'));  
router.use('/branches',   require('./modules/branches/branches.routes'));
router.use('/suppliers',  require('./modules/suppliers/suppliers.routes'));
router.use('/products',   require('./modules/products/products.routes')); 

module.exports = router;