'use strict';

/**
 * Prometheus metrics (docs/15-observability.md).
 *
 * Exposed on `GET /metrics` for scraping by a Prometheus server. Two families
 * are registered:
 *
 *   * Node.js default metrics (process CPU/heap/event loop, prefix `node_`)
 *   * `http_requests_total` / `http_request_duration_seconds` labelled by
 *     method, *matched route* and status code
 *
 * Labels use the Express route pattern (`/api/v1/bookings/:id`), never the raw
 * URL, so a request with an unknown id cannot explode label cardinality.
 */

const client = require('prom-client');

const config = require('../config/env');

/** Prometheus registry owned by this application (the global one is left alone). */
const registry = new client.Registry();

registry.setDefaultLabels({ service: config.logging.service });

/** Node.js runtime metrics (event loop lag, GC, heap, fds, ...). */
client.collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests handled, by method, route and status code.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds, by method, route and status code.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

/**
 * Low-cardinality route label for a request.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function routeLabel(req) {
  // `req.route.path` is only set once a route matched; baseUrl + path gives the
  // full pattern for routers mounted with a prefix.
  if (req.route && req.route.path) {
    return `${req.baseUrl || ''}${req.route.path}`;
  }
  return 'unmatched';
}

/**
 * Record duration + count for every response.
 *
 * @returns {import('express').RequestHandler}
 */
function metricsMiddleware() {
  return function recordHttpMetrics(req, res, next) {
    if (!config.observability.metrics.enabled) {
      return next();
    }

    const end = httpRequestDuration.startTimer();

    res.on('finish', () => {
      const labels = {
        method: req.method,
        route: routeLabel(req),
        status_code: String(res.statusCode),
      };
      httpRequestsTotal.inc(labels);
      end(labels);
    });

    return next();
  };
}

/**
 * Build the `GET /metrics` handler.
 *
 * When a token is configured the endpoint requires
 * `Authorization: Bearer <METRICS_TOKEN>` so an accidentally public scrape
 * endpoint cannot leak internal topology.
 *
 * @param {{token?: string, register?: import('prom-client').Registry}} [options]
 * @returns {import('express').RequestHandler}
 */
function createMetricsHandler(options = {}) {
  const { token = config.observability.metrics.token, register = registry } = options;

  return async function metricsHandler(req, res) {
    if (token && req.headers.authorization !== `Bearer ${token}`) {
      res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Metrics endpoint requires a bearer token',
      });
      return;
    }

    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  };
}

/**
 * Reset recorded metric values (tests only - keeps assertions deterministic).
 *
 * Only the values are cleared: the default metrics are registered once at module
 * load, so re-collecting them here would throw "already registered".
 */
function resetMetrics() {
  registry.resetMetrics();
}

module.exports = {
  registry,
  metricsMiddleware,
  createMetricsHandler,
  resetMetrics,
  routeLabel,
  httpRequestsTotal,
  httpRequestDuration,
};
