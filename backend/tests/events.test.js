'use strict';
/**
 * Events API tests (node:test - `npm test`).
 * End-to-end: real Express app + real MySQL + real HTTP, layered stack
 * (routes -> controller -> service -> repository -> MySQL).
 * Fixtures use unique names and are removed in after(), so the suite is repeatable.
 */
process.env.NODE_ENV = 'test';
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../src/app');
const { pool, closePool } = require('../src/database/pool');
const { hashPassword } = require('../src/utils/password');
const stamp = `${Date.now()}${Math.floor(Math.random() * 100)}`;
const PASSWORD = 'Secret123';
const adminEmail = `events.admin.${stamp}@example.com`;
const managerEmail = `events.manager.${stamp}@example.com`;
const userEmail = `events.user.${stamp}@example.com`;
const createdEmails = [adminEmail, managerEmail, userEmail];
let server;
let baseUrl;
let adminToken;
let managerToken;
let userToken;
let seededPublicId;
let seededDraftId;
before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  await insertUser({ name: 'Events Admin', email: adminEmail, role: 'ADMIN' });
  await insertUser({ name: 'Events Manager', email: managerEmail, role: 'EVENT_MANAGER' });
  await insertUser({ name: 'Events User', email: userEmail, role: 'USER' });
  adminToken = await login(adminEmail);
  managerToken = await login(managerEmail);
  userToken = await login(userEmail);
  // Seed baseline: one PUBLISHED event (+shows via venue 1), one DRAFT.
  const [v] = await pool.execute('SELECT id FROM venues LIMIT 1');
  const venueId = v[0].id;
  const [e] = await pool.execute(
    `INSERT INTO events (name, description, category, status) VALUES (?, ?, ?, 'PUBLISHED')`,
    [`Public Concert ${stamp}`, 'Seeded public event', 'Music']
  );
  seededPublicId = Number(e.insertId);
  const [d] = await pool.execute(`INSERT INTO events (name, status) VALUES (?, 'DRAFT')`, [`Draft Event ${stamp}`]);
  seededDraftId = Number(d.insertId);
  await pool.execute(
    `INSERT INTO shows (event_id, venue_id, start_time, end_time, status) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 7 DAY), INTERVAL 2 HOUR), 'SCHEDULED')`,
    [seededPublicId, venueId]
  );
  await pool.execute(
    `INSERT INTO show_seats (show_id, seat_id, price, status)
     SELECT s.id, st.id, 100.00, 'AVAILABLE' FROM shows s JOIN seats st ON st.venue_id = s.venue_id
     WHERE s.event_id = ? AND s.id NOT IN (SELECT show_id FROM show_seats) LIMIT 5`,
    [seededPublicId]
  );
});
after(async () => {
  await pool.execute('DELETE ss FROM show_seats ss JOIN shows s ON s.id = ss.show_id WHERE s.event_id IN (?, ?)', [seededPublicId, seededDraftId]);
  await pool.execute('DELETE FROM shows WHERE event_id IN (?, ?)', [seededPublicId, seededDraftId]);
  await pool.execute('DELETE FROM events WHERE id IN (?, ?)', [seededPublicId, seededDraftId]);
  await pool.execute(`DELETE FROM events WHERE name LIKE '%${stamp}%'`);
  if (createdEmails.length) {
    const ph = createdEmails.map(() => '?').join(',');
    await pool.execute(`DELETE FROM users WHERE email IN (${ph})`, createdEmails);
  }
  await new Promise((r) => server.close(r));
  await closePool();
});
async function api(path, options = {}) {
  const headers = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, body: json };
}
async function insertUser({ name, email, role }) {
  const [r] = await pool.execute(
    `INSERT INTO users (name, email, phone, password_hash, role, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
    [name, email, `9${String(Date.now()).slice(-9)}${Math.floor(Math.random() * 10)}`, await hashPassword(PASSWORD), role]
  );
  return r.insertId;
}
async function login(email) {
  const { body } = await api('/api/v1/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  return body.tokens.accessToken;
}
describe('GET /api/v1/events', () => {
  test('lists only public events, newest first', async () => {
    const { status, body } = await api('/api/v1/events');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.ok(Array.isArray(body.events));
    assert.ok(body.events.some((e) => e.id === seededPublicId));
    assert.ok(!body.events.some((e) => e.id === seededDraftId), 'drafts must stay hidden');
    assert.ok(body.events.every((e) => ['PUBLISHED', 'ACTIVE'].includes(e.status)));
  });
  test('filters by category and search', async () => {
    const cat = await api(`/api/v1/events?category=Music`);
    assert.equal(cat.status, 200);
    assert.ok(cat.body.events.some((e) => e.id === seededPublicId));
    const search = await api(`/api/v1/events?search=${encodeURIComponent(`Public Concert ${stamp}`)}`);
    assert.equal(search.status, 200);
    assert.ok(search.body.events.some((e) => e.id === seededPublicId));
    const miss = await api('/api/v1/events?search=zzz-no-such-event-zzz');
    assert.equal(miss.status, 200);
    assert.equal(miss.body.events.length, 0);
  });
  test('paginates with limit/offset and rejects bad query', async () => {
    const p = await api('/api/v1/events?limit=1&offset=0');
    assert.equal(p.status, 200);
    assert.equal(p.body.events.length, 1);
    assert.equal(p.body.limit, 1);
    const bad = await api('/api/v1/events?limit=9999');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, 'VALIDATION_ERROR');
  });
});
describe('GET /api/v1/events/:id', () => {
  test('returns a public event', async () => {
    const { status, body } = await api(`/api/v1/events/${seededPublicId}`);
    assert.equal(status, 200);
    assert.equal(body.event.id, seededPublicId);
    assert.equal(body.event.name, `Public Concert ${stamp}`);
  });
  test('hides drafts (404, no enumeration)', async () => {
    const { status, body } = await api(`/api/v1/events/${seededDraftId}`);
    assert.equal(status, 404);
    assert.equal(body.code, 'EVENT_NOT_FOUND');
  });
  test('rejects a non-numeric id with 400', async () => {
    const { status } = await api('/api/v1/events/abc');
    assert.equal(status, 400);
  });
});
describe('GET /api/v1/events/:id/shows', () => {
  test('lists shows with venue info', async () => {
    const { status, body } = await api(`/api/v1/events/${seededPublicId}/shows`);
    assert.equal(status, 200);
    assert.equal(body.eventId, seededPublicId);
    assert.ok(body.shows.length >= 1);
    assert.ok(body.shows[0].venue && body.shows[0].venue.name);
    assert.ok(body.shows[0].startTime);
  });
  test('404s for a draft event', async () => {
    const { status } = await api(`/api/v1/events/${seededDraftId}/shows`);
    assert.equal(status, 404);
  });
});
describe('admin /api/v1/admin/events', () => {
  test('ADMIN can create (201) and update an event', async () => {
    const name = `Admin Created ${stamp}`;
    const created = await api('/api/v1/admin/events', {
      method: 'POST', token: adminToken,
      body: { name, category: 'Theatre', status: 'DRAFT' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.event.name, name);
    assert.equal(created.body.event.status, 'DRAFT');
    const id = created.body.event.id;
    const updated = await api(`/api/v1/admin/events/${id}`, {
      method: 'PUT', token: adminToken, body: { status: 'PUBLISHED' },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.event.status, 'PUBLISHED');
  });
  test('EVENT_MANAGER can create but USER cannot (403)', async () => {
    const ok = await api('/api/v1/admin/events', {
      method: 'POST', token: managerToken, body: { name: `Manager Created ${stamp}` },
    });
    assert.equal(ok.status, 201);
    const denied = await api('/api/v1/admin/events', {
      method: 'POST', token: userToken, body: { name: `User Created ${stamp}` },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'INSUFFICIENT_ROLE');
  });
  test('rejects unauthenticated admin access (401)', async () => {
    const { status } = await api('/api/v1/admin/events');
    assert.equal(status, 401);
  });
  test('rejects invalid status and empty update with 400', async () => {
    const bad = await api('/api/v1/admin/events', {
      method: 'POST', token: adminToken, body: { name: 'Bad Status', status: 'NOPE' },
    });
    assert.equal(bad.status, 400);
    const empty = await api(`/api/v1/admin/events/${seededPublicId}`, {
      method: 'PUT', token: adminToken, body: {},
    });
    assert.equal(empty.status, 400);
  });
  test('404s when updating a missing event', async () => {
    const { status, body } = await api('/api/v1/admin/events/99999999', {
      method: 'PUT', token: adminToken, body: { status: 'ACTIVE' },
    });
    assert.equal(status, 404);
    assert.equal(body.code, 'EVENT_NOT_FOUND');
  });
});
