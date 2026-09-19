'use strict';

/**
 * HTTP request logging middleware (pino-http).
 *
 * Replaces morgan so request logs share the same structured format, request id
 * and redaction rules as the rest of the application (docs/15-observability.md).
 *
 *  * every response carries an `x-request-id` header (client supplied or generated)
 *  * health/metrics probes are not logged - they are noise, not signal
 *  * 4xx are logged at `warn`, 5xx and thrown errors at `error`
 */

const crypto = require('node:crypto');
const pinoHttp = require('pino-http');

const { logger } = require('../utils/logger');

/** Paths that must not pollute the request log (scraped every few seconds). */
const IGNORED_PATHS = ['/health', '/health/db', '/metrics'];

const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const id = typeof existing === 'string' && existing ? existing : crypto.randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} -> ${err.message}`,
  autoLogging: {
    ignore: (req) => IGNORED_PATHS.includes(req.url ?? ''),
  },
});

module.exports = { httpLogger, IGNORED_PATHS };
