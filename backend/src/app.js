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
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');
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
  // Required to read the httpOnly refresh-token cookie (docs/11-security.md §11.1).
  app.use(cookieParser());

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
      auth: {
        register: 'POST /api/v1/auth/register',
        login: 'POST /api/v1/auth/login',
        refresh: 'POST /api/v1/auth/refresh',
        logout: 'POST /api/v1/auth/logout',
        me: 'GET /api/v1/auth/me',
        verifyEmail: 'POST /api/v1/auth/verify-email',
        resendVerification: 'POST /api/v1/auth/resend-verification (Bearer)',
        forgotPassword: 'POST /api/v1/auth/forgot-password',
        resetPassword: 'POST /api/v1/auth/reset-password',
      },
      users: {
        me: 'GET /api/v1/users/me (Bearer)',
        updateMe: 'PUT /api/v1/users/me (Bearer)',
        changePassword: 'PUT /api/v1/users/me/password (Bearer)',
        getById: 'GET /api/v1/users/:id (Bearer, self or ADMIN)',
      },
      admin: { listUsers: 'GET /api/v1/admin/users (ADMIN only)' },
    });
  });

  // Connectivity probes
  app.use('/health', healthRoutes);

  // Feature routers (docs/04-api-design.md)
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/admin', adminRoutes);

  // Remaining modules mount here as they are implemented, e.g.
  //   app.use('/api/v1/events', eventRoutes);
  //   app.use('/api/v1/shows', showRoutes);
  //   app.use('/api/v1/bookings', bookingRoutes);
  //   app.use('/api/v1/payments', paymentRoutes);
  //   app.use('/api/v1/tickets', ticketRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;