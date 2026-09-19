'use strict';

/**
 * Unit tests: optional Sentry error tracking (docs/15-observability.md).
 *
 * The API must stay fully functional - and the SDK must stay unloaded - when no
 * SENTRY_DSN is configured, so the default installation remains self-contained.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');

const config = require('../../src/config/env');
const {
  isEnabled,
  initErrorTracking,
  captureException,
  resetErrorTracking,
  ...rest
} = require('../../src/utils/error-tracking');

after(() => {
  resetErrorTracking();
  config.observability.errorTracking.dsn = '';
});

test('the module exposes only its documented surface', () => {
  assert.deepEqual(Object.keys(rest), ['setErrorTrackingClientForTests']);
});

test('error tracking is disabled and inert without SENTRY_DSN', () => {
  assert.equal(config.observability.errorTracking.dsn, '');
  assert.equal(isEnabled(), false);
  assert.equal(initErrorTracking(), false);
  assert.equal(captureException(new Error('nothing configured')), false);
});

test('captureException reports the error with request context when a client is present', () => {
  const captured = [];
  const scopes = [];
  const stub = {
    withScope(callback) {
      callback({
        setTag: (key, value) => scopes.push([key, value]),
        setExtras: (extras) => scopes.push(['extras', extras]),
      });
    },
    captureException: (error) => captured.push(error),
  };

  const previous = rest.setErrorTrackingClientForTests(stub);
  try {
    const error = new Error('booking failed');
    const handled = captureException(error, {
      requestId: 'req-1',
      method: 'POST',
      url: '/api/v1/bookings/hold',
      bookingId: 7,
    });

    assert.equal(handled, true);
    assert.deepEqual(captured, [error]);
    assert.deepEqual(scopes, [
      ['request_id', 'req-1'],
      ['http.method', 'POST'],
      ['http.url', '/api/v1/bookings/hold'],
      ['extras', { bookingId: 7 }],
    ]);
  } finally {
    rest.setErrorTrackingClientForTests(previous);
  }
});

test('captureException tolerates a missing context object', () => {
  const stub = {
    withScope(callback) {
      callback({ setTag: () => {}, setExtras: () => {} });
    },
    captureException: () => {},
  };

  const previous = rest.setErrorTrackingClientForTests(stub);
  try {
    assert.equal(captureException(new Error('no context')), true);
  } finally {
    rest.setErrorTrackingClientForTests(previous);
  }
});
