'use strict';

/**
 * Error tracking (docs/15-observability.md).
 *
 * Sentry is opt-in: without `SENTRY_DSN` the API is completely self-contained
 * and every function here is a no-op, so local development, tests and the
 * docker-compose stack need no external account.
 *
 * `@sentry/node` is required lazily inside `initErrorTracking()` so the
 * instrumentation (OpenTelemetry require hooks) is only loaded when a DSN is
 * actually configured.
 */

const config = require('../config/env');

/** @type {typeof import('@sentry/node')|null} */
let client = null;

/** @returns {boolean} true when a DSN is configured */
function isEnabled() {
  return Boolean(config.observability.errorTracking.dsn);
}

/**
 * Initialise Sentry and (optionally) register its Express error handler.
 *
 * @param {import('express').Express} [app] when provided, thrown errors are captured automatically
 * @returns {boolean} true when error tracking became active
 */
function initErrorTracking(app) {
  if (!isEnabled()) {
    return false;
  }

  if (client) {
    return true;
  }

  // Loaded lazily: an installation without Sentry configured pays nothing.
  const Sentry = require('@sentry/node');

  Sentry.init({
    dsn: config.observability.errorTracking.dsn,
    environment: config.env,
    release: config.logging.service,
    tracesSampleRate: config.observability.errorTracking.tracesSampleRate,
  });

  // Registered before the application error handler so Sentry sees the error
  // first and then re-throws it into src/middlewares/error-handler.js.
  if (app && typeof Sentry.setupExpressErrorHandler === 'function') {
    Sentry.setupExpressErrorHandler(app);
  }

  client = Sentry;
  return true;
}

/**
 * Report an error, with optional request context.
 *
 * @param {Error} error
 * @param {{requestId?: string, method?: string, url?: string, [key: string]: unknown}} [context]
 * @returns {boolean} true when the error was handed to the tracker
 */
function captureException(error, context = {}) {
  if (!client) {
    return false;
  }

  client.withScope((scope) => {
    if (context.requestId) {
      scope.setTag('request_id', String(context.requestId));
    }
    if (context.method) {
      scope.setTag('http.method', context.method);
    }
    if (context.url) {
      scope.setTag('http.url', context.url);
    }
    const extras = { ...context };
    delete extras.requestId;
    delete extras.method;
    delete extras.url;
    if (Object.keys(extras).length > 0) {
      scope.setExtras(extras);
    }
    client.captureException(error);
  });

  return true;
}

/** Detach the tracker (tests only). */
function resetErrorTracking() {
  client = null;
}

/**
 * Swap the underlying client and return the previous one (tests only).
 *
 * Lets the unit tests assert the capture wiring without sending events to a
 * real Sentry project.
 *
 * @param {object|null} stub
 * @returns {object|null} the client that was active before the swap
 */
function setErrorTrackingClientForTests(stub) {
  const previous = client;
  client = stub;
  return previous;
}

module.exports = {
  isEnabled,
  initErrorTracking,
  captureException,
  resetErrorTracking,
  setErrorTrackingClientForTests,
};
