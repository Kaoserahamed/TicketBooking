'use strict';

/**
 * Structured application logging (docs/15-observability.md).
 *
 * Pino is used instead of ad-hoc `console.log` calls so every line is a single
 * JSON object that a log pipeline can index by level, request id and route.
 * Secrets are redacted centrally here, which is the only safe place to do it:
 * a credential that never reaches the transport can never reach a log store.
 *
 * Environment:
 *   LOG_LEVEL      trace|debug|info|warn|error|fatal|silent (default info,
 *                  silent when NODE_ENV=test so the test output stays readable)
 *   SERVICE_NAME   `service` field written on every line
 */

const pino = require('pino');

const config = require('../config/env');

/**
 * Fields that must never be written to logs (docs/11-security.md §11.2).
 * Paths are pino-style: `*.name` matches the key at any depth.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'password',
  '*.password',
  'newPassword',
  '*.newPassword',
  'currentPassword',
  '*.currentPassword',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'secret',
  '*.secret',
];

const REDACTED = '[redacted]';

/**
 * Build a pino logger.
 *
 * `destination` makes the logger testable: the unit tests write to a memory
 * stream and assert on the emitted JSON (including redaction).
 *
 * @param {{level?: string, destination?: import('node:stream').Writable, service?: string, [key: string]: unknown}} [options]
 * @returns {import('pino').Logger}
 */
function createLogger(options = {}) {
  const { level = config.logging.level, destination, service, ...rest } = options;

  const pinoOptions = {
    level,
    name: service || config.logging.service,
    base: { service: service || config.logging.service, env: config.env },
    redact: { paths: REDACT_PATHS, censor: REDACTED },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    ...rest,
  };

  return destination ? pino(pinoOptions, destination) : pino(pinoOptions);
}

/** Application-wide logger. */
const logger = createLogger();

/**
 * Child logger carrying fixed context (e.g. a request id or a service module).
 *
 * @param {Record<string, unknown>} bindings
 * @returns {import('pino').Logger}
 */
function createChildLogger(bindings) {
  return logger.child(bindings);
}

module.exports = {
  logger,
  createLogger,
  createChildLogger,
  REDACT_PATHS,
  REDACTED,
};
