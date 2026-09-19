'use strict';

/**
 * API entry point (docs/12-deployment.md -> backend/src/index.ts).
 *
 * Boots the Express app, verifies the MySQL connection, and shuts down
 * gracefully so pooled connections are released.
 */

const createApp = require('./app');
const config = require('./config/env');
const { logger } = require('./utils/logger');
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
    logger.info(
      {
        database: info.database,
        host: info.host,
        port: info.port,
        mysql: info.version,
        tables: info.tables,
      },
      'database connection established'
    );
  } catch (error) {
    logger.error({ err: error }, 'database connection failed - /health/db will report it');
    logger.warn('check that MySQL is running and the DB_* values in .env are correct');
  }

  const server = app.listen(config.port, () => {
    logger.info(
      {
        port: config.port,
        env: config.env,
        health: `/health`,
        databaseHealth: `/health/db`,
        metrics: config.observability.metrics.enabled ? '/metrics' : 'disabled',
        errorTracking: config.observability.errorTracking.dsn ? 'sentry' : 'disabled',
        logLevel: config.logging.level,
      },
      'Ticket Booking API listening'
    );
  });

  const shutdown = (signal) => {
    logger.info({ signal }, 'shutdown signal received');
    server.close(async () => {
      await closePool();
      await closeRedis();
      logger.info('shutdown complete');
      process.exit(0);
    });
  };

  ['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, () => shutdown(signal)));
}

start().catch((error) => {
  logger.fatal({ err: error }, 'failed to start server');
  process.exit(1);
});
