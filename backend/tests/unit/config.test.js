'use strict';

/**
 * Unit tests: configuration guards (src/config/env.js).
 *
 * The important invariants are the ones that must hold *before* the server
 * starts, and they depend on the process environment - so each case runs in a
 * child Node process with an explicit environment
 * (docs/11-security.md §11.2).
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const BACKEND_DIR = path.resolve(__dirname, '..', '..');
const NODE = process.execPath;

const PROBE = `
  const c = require('./src/config/env');
  process.stdout.write(JSON.stringify({
    env: c.env,
    port: c.port,
    connectionLimit: c.database.connectionLimit,
    cookieSecure: c.cookie.secure,
    logLevel: c.logging.level,
    metricsEnabled: c.observability.metrics.enabled,
    metricsToken: c.observability.metrics.token,
    tracingDsn: c.observability.errorTracking.dsn,
  }));
`;

/** Variables the assertions control, so an ambient .env cannot change the result. */
const CONTROLLED = [
  'NODE_ENV',
  'PORT',
  'DB_CONNECTION_LIMIT',
  'COOKIE_SECURE',
  'LOG_LEVEL',
  'METRICS_ENABLED',
  'METRICS_TOKEN',
  'SENTRY_DSN',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

/**
 * Run the probe with a controlled environment.
 *
 * @param {Record<string, string>} overrides
 * @returns {{ok: boolean, config?: object, status?: number|null, stderr?: string}}
 */
function loadConfig(overrides) {
  const env = { ...process.env };
  // Empty string keeps dotenv from filling these from a developer's root .env.
  CONTROLLED.forEach((name) => {
    env[name] = '';
  });
  Object.assign(env, overrides);

  try {
    const stdout = execFileSync(NODE, ['-e', PROBE], {
      cwd: BACKEND_DIR,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, config: JSON.parse(stdout) };
  } catch (error) {
    return { ok: false, status: error.status, stderr: String(error.stderr || error.message) };
  }
}

test('production refuses to start without JWT secrets', () => {
  const result = loadConfig({ NODE_ENV: 'production' });

  assert.equal(result.ok, false, 'the process must exit instead of starting with no secret');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /JWT_SECRET must be set when NODE_ENV=production/);
});

test('production refuses the development placeholder secrets', () => {
  const result = loadConfig({
    NODE_ENV: 'production',
    JWT_SECRET: 'dev-only-access-secret-change-me',
    JWT_REFRESH_SECRET: 'dev-only-refresh-secret-change-me',
  });

  assert.equal(result.ok, false);
  assert.match(result.stderr, /development JWT secrets are not allowed/);
});

test('production with real secrets enables secure cookies', () => {
  const result = loadConfig({
    NODE_ENV: 'production',
    JWT_SECRET: 'a-production-grade-access-secret',
    JWT_REFRESH_SECRET: 'a-production-grade-refresh-secret',
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.env, 'production');
  assert.equal(result.config.cookieSecure, true);
  assert.equal(result.config.logLevel, 'info');
});

test('development falls back to documented defaults', () => {
  const result = loadConfig({ NODE_ENV: 'development' });

  assert.equal(result.ok, true);
  assert.equal(result.config.port, 4000);
  assert.equal(result.config.connectionLimit, 10);
  assert.equal(result.config.cookieSecure, false);
  assert.equal(result.config.metricsEnabled, true);
  assert.equal(result.config.metricsToken, '');
  assert.equal(result.config.tracingDsn, '');
});

test('numeric and boolean settings are coerced from the environment', () => {
  const result = loadConfig({
    NODE_ENV: 'test',
    PORT: '5050',
    DB_CONNECTION_LIMIT: '25',
    LOG_LEVEL: 'trace',
    METRICS_ENABLED: 'false',
    METRICS_TOKEN: 'scrape-token',
    SENTRY_DSN: 'https://public@example.invalid/1',
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.port, 5050);
  assert.equal(result.config.connectionLimit, 25);
  assert.equal(result.config.logLevel, 'trace');
  assert.equal(result.config.metricsEnabled, false);
  assert.equal(result.config.metricsToken, 'scrape-token');
  assert.equal(result.config.tracingDsn, 'https://public@example.invalid/1');
});

test('an invalid PORT falls back instead of producing NaN', () => {
  const result = loadConfig({ NODE_ENV: 'development', PORT: 'not-a-port' });

  assert.equal(result.ok, true);
  assert.equal(result.config.port, 4000);
});

test('test runs are silent by default so suite output stays readable', () => {
  const result = loadConfig({ NODE_ENV: 'test' });
  assert.equal(result.ok, true);
  assert.equal(result.config.logLevel, 'silent');
});
