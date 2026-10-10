const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { notFound, errorHandler } = require('./middleware/errors');
const authRoutes = require('./modules/auth/auth.routes');

const app = express();

// --- global middleware ---
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// --- health check ---
app.get('/api/health', (req, res) => {
  res.json({ data: { status: 'ok' } });
});

// --- routes ---
app.use('/api/auth', authRoutes);

// --- 404 + error handler (must be last) ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;