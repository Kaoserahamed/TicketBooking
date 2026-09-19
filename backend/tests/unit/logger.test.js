'use strict';

/**
 * Unit tests: structured logging and secret redaction (docs/15-observability.md).
 *
 * The logger is built with an in-memory destination so the emitted JSON can be
 * asserted directly - including the guarantee that credentials never reach the
 * log stream.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');

const config = require('../../src/config/env');
const {
  createLogger,
  createChildLogger,
  logger,
  REDACT_PATHS,
  REDACTED,
} = require('../../src/utils/logger');

/** Collect everything a pino instance writes. */
function memoryStream() {
  const lines = [];
  const stream = new Writable({
    write(chunk, encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  return { stream, lines };
}

function parseLines(lines) {
  return lines
    .join('')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test('the shared logger is silent while NODE_ENV=test', () => {
  assert.equal(config.env, 'test');
  assert.equal(config.logging.level, 'silent');
  assert.equal(logger.level, 'silent');
});

test('log lines are single JSON objects with service, env and ISO timestamp', () => {
  const { stream, lines } = memoryStream();
  const log = createLogger({ level: 'info', destination: stream });

  log.info({ route: '/api/v1/events' }, 'handled request');

  const [entry] = parseLines(lines);
  assert.equal(entry.level, 'info');
  assert.equal(entry.msg, 'handled request');
  assert.equal(entry.route, '/api/v1/events');
  assert.equal(entry.service, 'ticket-booking-api');
  assert.equal(entry.env, 'test');
  assert.ok(!Number.isNaN(Date.parse(entry.time)), 'time must be an ISO timestamp');
});

test('credentials are redacted everywhere they can appear', () => {
  const { stream, lines } = memoryStream();
  const log = createLogger({ level: 'info', destination: stream });

  log.info(
    {
      req: {
        headers: {
          authorization: 'Bearer super-secret-access-token',
          cookie: 'tb_refresh_token=super-secret-refresh-token',
        },
      },
      password: 'super-secret-password',
      nested: { token: 'super-secret-nested-token' },
    },
    'login attempt'
  );

  const serialized = lines.join('');
  assert.ok(!serialized.includes('super-secret-access-token'));
  assert.ok(!serialized.includes('super-secret-refresh-token'));
  assert.ok(!serialized.includes('super-secret-password'));
  assert.ok(!serialized.includes('super-secret-nested-token'));
  assert.ok(serialized.includes(REDACTED));

  // The redaction list covers the credential field names used by the API.
  ['password', 'token', 'accessToken', 'refreshToken', 'secret'].forEach((field) => {
    assert.ok(
      REDACT_PATHS.some((path) => path === field || path === `*.${field}`),
      `${field} must be in REDACT_PATHS`
    );
  });
});

test('log level can be raised for a single logger instance', () => {
  const { stream, lines } = memoryStream();
  const log = createLogger({
    level: 'warn',
    destination: stream,
    service: 'ticket-booking-worker',
  });

  log.info('not emitted');
  log.warn('emitted');

  const entries = parseLines(lines);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].msg, 'emitted');
  assert.equal(entries[0].service, 'ticket-booking-worker');
});

test('child loggers inherit level and add fixed context', () => {
  const child = createChildLogger({ module: 'booking.service' });
  assert.equal(child.level, logger.level);
});
