'use strict';

/**
 * API smoke tests (Node.js built-in test runner - run with `npm test`).
 *
 * The server is started on an ephemeral port so the suite never collides with
 * a running dev server. The database test accepts either outcome: it must
 * report 200 when MySQL is reachable and a clean 503 when it is not, but it
 * must never crash the process.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const createApp = require('../../src/app');
const config = require('../../src/config/env');
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

test('GET / returns API metadata', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.name, 'ticket-booking-api');
  assert.equal(body.basePath, '/api/v1');
});

test('GET /health/db reports MySQL connectivity', async () => {
  const res = await fetch(`${baseUrl}/health/db`);
  const body = await res.json();

  if (res.status === 200) {
    assert.equal(body.status, 'ok');
    assert.equal(body.database.connected, true);
    assert.equal(body.database.database, config.database.name);
    assert.equal(typeof body.database.tables, 'number');
  } else {
    assert.equal(res.status, 503);
    assert.equal(body.status, 'error');
    assert.equal(body.database.connected, false);
    assert.ok(body.database.message);
  }
});

test('unknown routes return a JSON 404', async () => {
  const res = await fetch(`${baseUrl}/definitely-not-a-route`);
  assert.equal(res.status, 404);

  const body = await res.json();
  assert.equal(body.status, 'error');
  assert.match(body.message, /Route not found/);
});
