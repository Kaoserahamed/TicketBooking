'use strict';

/**
 * Health routes - used to verify the two connections this service depends on:
 *   GET /health     -> the HTTP server is up (liveness, no database access)
 *   GET /health/db  -> the API can reach MySQL (readiness)
 *
 * Mounted at /health by src/app.js.
 */

const express = require('express');
const config = require('../config/env');
const { testConnection } = require('../database/pool');

const router = express.Router();

// GET /health - liveness probe.
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ticket-booking-backend',
    env: config.env,
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    timestamp: new Date().toISOString(),
  });
});

// GET /health/db - readiness probe: verifies the MySQL connection.
router.get('/db', async (req, res) => {
  try {
    const database = await testConnection();
    res.json({ status: 'ok', database });
  } catch (error) {
    // 503 Service Unavailable: the process is alive but a dependency is not ready.
    res.status(503).json({
      status: 'error',
      database: {
        connected: false,
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
