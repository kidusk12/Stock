const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

// --- global middleware ---
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// --- routes ---
app.use('/api', routes);

// --- 404 + error handler (must be last) ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;