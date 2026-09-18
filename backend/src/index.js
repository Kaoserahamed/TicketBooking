'use strict';

/**
 * API entry point (docs/12-deployment.md -> backend/src/index.ts).
 *
 * Boots the Express app, verifies the MySQL connection, and shuts down
 * gracefully so pooled connections are released.
 */

const createApp = require('./app');
const config = require('./config/env');
const { testConnection, closePool } = require('./database/pool');
const { initRateLimitStore } = require('./middlewares/rate-limit');
const { closeRedis } = require('./cache/redis');

async function start() {
  const app = createApp();

  // Redis-backed rate limiting across instances when configured; otherwise
  // the in-process store is used and the API still starts normally.
  await initRateLimitStore();

  // Verify the database connection before accepting traffic.
  try {
    const info = await testConnection();
    console.log(
      `[db] connected to "${info.database}" at ${info.host}:${info.port} ` +
        `(MySQL ${info.version}, ${info.tables} tables)`
    );
  } catch (error) {
    console.error(`[db] connection FAILED: ${error.message}`);
    console.error('[db] server will still start - GET /health/db will report the failure.');
    console.error('[db] check that MySQL is running and the DB_* values in .env are correct.');
  }

  const server = app.listen(config.port, () => {
    console.log(`[server] Ticket Booking API listening on http://localhost:${config.port} (${config.env})`);
    console.log(`[server] server health: http://localhost:${config.port}/health`);
    console.log(`[server] database health: http://localhost:${config.port}/health/db`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received - shutting down`);
    server.close(async () => {
      await closePool();
      await closeRedis();
      console.log('[server] shutdown complete');
      process.exit(0);
    });
  };

  ['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, () => shutdown(signal)));
}

start().catch((error) => {
  console.error('[server] failed to start:', error);
  process.exit(1);
});