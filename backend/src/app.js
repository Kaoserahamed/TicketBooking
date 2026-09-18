'use strict';

/**
 * Express application factory.
 *
 * Kept separate from src/index.js so tests can boot the app on an ephemeral
 * port without opening the configured production port.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const notFound = require('./middlewares/not-found');
const errorHandler = require('./middlewares/error-handler');

/**
 * @returns {import('express').Express} configured Express application
 */
function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Security headers - docs/11-security.md
  app.use(helmet());

  // TODO: restrict origins per environment once the frontend URL is known.
  app.use(cors());

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (config.env !== 'test') {
    app.use(morgan('dev'));
  }

  // Service metadata
  app.get('/', (req, res) => {
    res.json({
      name: 'ticket-booking-api',
      version: '0.1.0',
      basePath: '/api/v1',
      health: { server: '/health', database: '/health/db' },
    });
  });

  // Connectivity probes
  app.use('/health', healthRoutes);

  // Feature routers are mounted here as they are implemented, e.g.
  //   app.use('/api/v1/auth', authRoutes);
  //   app.use('/api/v1/events', eventRoutes);
  //   app.use('/api/v1/shows', showRoutes);
  //   app.use('/api/v1/bookings', bookingRoutes);
  //   app.use('/api/v1/payments', paymentRoutes);
  //   app.use('/api/v1/tickets', ticketRoutes);
  //   app.use('/api/v1/admin', adminRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;