'use strict';

/**
 * Unit tests: Prometheus metrics (docs/15-observability.md).
 *
 * Requests are served by a throwaway Express app so the assertions never need
 * the real router stack or a database.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const config = require('../../src/config/env');
const {
  registry,
  metricsMiddleware,
  createMetricsHandler,
  resetMetrics,
  routeLabel,
} = require('../../src/utils/metrics');

let server;
let baseUrl;

before(async () => {
  resetMetrics();

  const app = express();
  app.use(metricsMiddleware());
  app.get('/metrics', createMetricsHandler());
  app.get('/ping/:id', (req, res) => res.json({ ok: true }));
  app.get('/broken', () => {
    throw new Error('boom');
  });
  app.use((err, req, res, _next) => {
    res.status(500).json({ status: 'error' });
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('the registry collects Node.js default metrics', async () => {
  const body = await registry.metrics();
  assert.match(body, /process_cpu|nodejs_heap/);
  assert.ok(registry.getSingleMetric('http_requests_total'));
  assert.ok(registry.getSingleMetric('http_request_duration_seconds'));
});

test('requests are counted and timed using the route pattern, not the raw URL', async () => {
  await fetch(`${baseUrl}/ping/42`);

  const body = await registry.metrics();
  assert.match(
    body,
    /http_requests_total\{[^}]*method="GET"[^}]*route="\/ping\/:id"[^}]*status_code="200"[^}]*\}/
  );
  assert.match(body, /http_request_duration_seconds_bucket\{[^}]*route="\/ping\/:id"/);
  // The concrete id must not become a label value (cardinality control).
  assert.ok(!body.includes('route="/ping/42"'));
});

test('failed requests are labelled with the matched route and 500 status', async () => {
  await fetch(`${baseUrl}/broken`);
  const body = await registry.metrics();
  assert.match(body, /route="\/broken"[^}]*status_code="500"/);
});

test('unmatched requests are grouped under a single label value', async () => {
  await fetch(`${baseUrl}/not-a-route`);

  const body = await registry.metrics();
  assert.match(body, /route="unmatched"[^}]*status_code="404"/);
  assert.equal(routeLabel({ method: 'GET' }), 'unmatched');
});

test('GET /metrics returns the Prometheus exposition format', async () => {
  const res = await fetch(`${baseUrl}/metrics`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/plain/);
  assert.match(await res.text(), /# HELP http_requests_total/);
});

test('a configured METRICS_TOKEN protects the scrape endpoint', async () => {
  const app = express();
  app.get('/metrics', createMetricsHandler({ token: 's3cret' }));
  const protectedServer = app.listen(0);
  await new Promise((resolve) => protectedServer.once('listening', resolve));
  const url = `http://127.0.0.1:${protectedServer.address().port}/metrics`;

  try {
    const unauthorized = await fetch(url);
    assert.equal(unauthorized.status, 401);
    assert.equal((await unauthorized.json()).code, 'UNAUTHORIZED');

    const authorized = await fetch(url, { headers: { Authorization: 'Bearer s3cret' } });
    assert.equal(authorized.status, 200);
    assert.match(await authorized.text(), /http_requests_total/);
  } finally {
    await new Promise((resolve) => protectedServer.close(resolve));
  }
});

test('METRICS_ENABLED=false disables recording without breaking requests', async () => {
  const previous = config.observability.metrics.enabled;
  config.observability.metrics.enabled = false;

  try {
    const app = express();
    app.use(metricsMiddleware());
    app.get('/noop', (req, res) => res.json({ ok: true }));
    const disabledServer = app.listen(0);
    await new Promise((resolve) => disabledServer.once('listening', resolve));

    const res = await fetch(`http://127.0.0.1:${disabledServer.address().port}/noop`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);

    await new Promise((resolve) => disabledServer.close(resolve));
  } finally {
    config.observability.metrics.enabled = previous;
  }
});
