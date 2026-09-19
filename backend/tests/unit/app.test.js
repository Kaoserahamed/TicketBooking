'use strict';

/**
 * Unit tests: application wiring that needs no external service.
 *
 * `npm run test:unit` runs this directory on a fresh clone with no MySQL and no
 * Redis, which is what makes the suite verifiable in isolation
 * (docs/14-operations.md). Database-backed assertions live in
 * `tests/integration/`.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const createApp = require('../../src/app');
const { closePool } = require('../../src/database/pool');

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  // Release pooled MySQL connections so the test process can exit.
  await closePool();
});

test('GET /health reports the server is up', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'ticket-booking-backend');
  assert.equal(typeof body.uptimeSeconds, 'number');
  assert.ok(body.timestamp);
});

test('GET / returns API metadata including the observability endpoints', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.name, 'ticket-booking-api');
  assert.equal(body.basePath, '/api/v1');
  assert.ok(body.observability);
  assert.match(body.observability.metrics, /metrics/);
});

test('GET /metrics exposes Prometheus metrics without touching the database', async () => {
  const res = await fetch(`${baseUrl}/metrics`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/plain/);

  const body = await res.text();
  // Application metric plus the Node.js default metrics registered at startup.
  assert.match(body, /http_requests_total/);
  assert.match(body, /process_cpu|nodejs_/);
});

test('every response carries an x-request-id header', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.ok(res.headers.get('x-request-id'));

  // A caller supplied id is echoed so logs can be correlated across services.
  const echoed = await fetch(`${baseUrl}/health`, { headers: { 'x-request-id': 'trace-123' } });
  assert.equal(echoed.headers.get('x-request-id'), 'trace-123');
});

test('helmet security headers are applied and x-powered-by is removed', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('unknown routes return the documented error envelope', async () => {
  const res = await fetch(`${baseUrl}/api/v1/does-not-exist`);
  assert.equal(res.status, 404);

  const body = await res.json();
  assert.equal(body.status, 'error');
  assert.equal(body.code, 'NOT_FOUND');
});

test('malformed JSON is rejected with 400 INVALID_JSON', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email": "broken"',
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, 'INVALID_JSON');
});

test('validation errors use the documented error envelope', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email' }),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.status, 'error');
  assert.ok(Array.isArray(body.errors));
  assert.ok(body.errors.length > 0);
});
