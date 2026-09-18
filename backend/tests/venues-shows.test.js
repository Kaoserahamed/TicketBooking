'use strict';
/**
 * Venues, shows and seat-inventory API tests (node:test - `npm test`).
 * End-to-end: real Express app + real MySQL + real HTTP, layered stack
 * (routes -> controller -> service -> repository -> MySQL).
 * Fixtures use a unique stamp and are removed in after(), so the suite is repeatable.
 */
process.env.NODE_ENV = 'test';
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../src/app');
const { pool, closePool } = require('../src/database/pool');
const { hashPassword } = require('../src/utils/password');
const stamp = `${Date.now()}${Math.floor(Math.random() * 100)}`;
const PASSWORD = 'Secret123';
const adminEmail = `venue.admin.${stamp}@example.com`;
const venueManagerEmail = `venue.manager.${stamp}@example.com`;
const eventManagerEmail = `venue.eventmanager.${stamp}@example.com`;
const userEmail = `venue.user.${stamp}@example.com`;
const createdEmails = [adminEmail, venueManagerEmail, eventManagerEmail, userEmail];
let server;
let baseUrl;
let adminToken;
let venueManagerToken;
let eventManagerToken;
let userToken;
let venueId;
let eventId;
let showId;
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
    [name, email, `8${String(Date.now()).slice(-9)}${Math.floor(Math.random() * 10)}`, await hashPassword(PASSWORD), role]
  );
  return r.insertId;
}
async function login(email) {
  const { body } = await api('/api/v1/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  return body.tokens.accessToken;
}
before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  await insertUser({ name: 'Venue Admin', email: adminEmail, role: 'ADMIN' });
  await insertUser({ name: 'Venue Manager', email: venueManagerEmail, role: 'VENUE_MANAGER' });
  await insertUser({ name: 'Event Manager', email: eventManagerEmail, role: 'EVENT_MANAGER' });
  await insertUser({ name: 'Venue User', email: userEmail, role: 'USER' });
  adminToken = await login(adminEmail);
  venueManagerToken = await login(venueManagerEmail);
  eventManagerToken = await login(eventManagerEmail);
  userToken = await login(userEmail);
  const [v] = await pool.execute(`INSERT INTO venues (name, address, city, capacity) VALUES (?, ?, ?, ?)`, [`Test Hall ${stamp}`, '1 Test St', 'Testville', 12]);
  venueId = Number(v.insertId);
  // 2 rows x 3 seats = 6 seats.
  for (const row of ['A', 'B']) {
    for (const num of ['1', '2', '3']) {
      await pool.execute(`INSERT INTO seats (venue_id, \`row_number\`, seat_number, seat_type) VALUES (?, ?, ?, 'REGULAR')`, [venueId, row, num]);
    }
  }
  const [e] = await pool.execute(`INSERT INTO events (name, status) VALUES (?, 'PUBLISHED')`, [`Venue Test Event ${stamp}`]);
  eventId = Number(e.insertId);
  const [s] = await pool.execute(
    `INSERT INTO shows (event_id, venue_id, start_time, end_time, status) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 9 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 9 DAY), INTERVAL 2 HOUR), 'SCHEDULED')`,
    [eventId, venueId]
  );
  showId = Number(s.insertId);
  await pool.execute(
    `INSERT IGNORE INTO show_seats (show_id, seat_id, price, status) SELECT ?, id, 150.00, 'AVAILABLE' FROM seats WHERE venue_id = ?`,
    [showId, venueId]
  );
});
describe('GET /api/v1/venues', () => {
  test('lists venues and filters by city', async () => {
    const { status, body } = await api('/api/v1/venues');
    assert.equal(status, 200);
    assert.ok(body.venues.some((v) => v.id === venueId));
    const city = await api('/api/v1/venues?city=Testville');
    assert.equal(city.status, 200);
    assert.ok(city.body.venues.some((v) => v.id === venueId));
    const miss = await api('/api/v1/venues?city=NoSuchCityZZZ');
    assert.equal(miss.status, 200);
    assert.ok(!miss.body.venues.some((v) => v.id === venueId));
  });
  test('rejects a bad limit with 400', async () => {
    const { status, body } = await api('/api/v1/venues?limit=9999');
    assert.equal(status, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });
});
describe('GET /api/v1/venues/:id', () => {
  test('returns the venue with a seat summary', async () => {
    const { status, body } = await api(`/api/v1/venues/${venueId}`);
    assert.equal(status, 200);
    assert.equal(body.venue.id, venueId);
    assert.equal(body.venue.seats.total, 6);
  });
  test('404s for a missing venue', async () => {
    const { status, body } = await api('/api/v1/venues/99999999');
    assert.equal(status, 404);
    assert.equal(body.code, 'VENUE_NOT_FOUND');
  });
});
describe('GET /api/v1/venues/:id/seats', () => {
  test('lists the seat layout with labels', async () => {
    const { status, body } = await api(`/api/v1/venues/${venueId}/seats`);
    assert.equal(status, 200);
    assert.equal(body.total, 6);
    assert.ok(body.seats.some((s) => s.label === 'A1'));
    assert.ok(body.seats.every((s) => s.venueId === venueId));
  });
});
describe('GET /api/v1/shows', () => {
  test('lists shows with event/venue/counts', async () => {
    const { status, body } = await api(`/api/v1/shows?eventId=${eventId}`);
    assert.equal(status, 200);
    assert.ok(body.shows.some((s) => s.id === showId));
    const found = body.shows.find((s) => s.id === showId);
    assert.equal(found.venue.name, `Test Hall ${stamp}`);
    assert.equal(found.seats.total, 6);
  });
  test('supports the upcoming filter', async () => {
    const { status, body } = await api('/api/v1/shows?upcoming=true');
    assert.equal(status, 200);
    assert.ok(body.shows.some((s) => s.id === showId));
  });
});
describe('GET /api/v1/shows/:id', () => {
  test('returns show detail', async () => {
    const { status, body } = await api(`/api/v1/shows/${showId}`);
    assert.equal(status, 200);
    assert.equal(body.show.id, showId);
    assert.equal(body.show.seats.available, 6);
  });
  test('404s for a missing show', async () => {
    const { status, body } = await api('/api/v1/shows/99999999');
    assert.equal(status, 404);
    assert.equal(body.code, 'SHOW_NOT_FOUND');
  });
});
describe('GET /api/v1/shows/:id/seats + /availability', () => {
  test('seat map lists every provisioned seat', async () => {
    const { status, body } = await api(`/api/v1/shows/${showId}/seats`);
    assert.equal(status, 200);
    assert.equal(body.total, 6);
    assert.ok(body.seats.every((s) => s.status === 'AVAILABLE'));
    assert.ok(body.seats[0].price !== undefined);
  });
  test('availability totals + per-row', async () => {
    const { status, body } = await api(`/api/v1/shows/${showId}/availability`);
    assert.equal(status, 200);
    assert.equal(body.availability.total, 6);
    assert.equal(body.availability.available, 6);
    assert.equal(body.availability.byRow.length, 2);
  });
});
describe('admin venues + seats', () => {
  test('VENUE_MANAGER can create and update a venue; USER cannot (403)', async () => {
    const name = `Managed Hall ${stamp}`;
    const created = await api('/api/v1/admin/venues', {
      method: 'POST', token: venueManagerToken,
      body: { name, city: 'Managed City', capacity: 50 },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.venue.name, name);
    const id = created.body.venue.id;
    const updated = await api(`/api/v1/admin/venues/${id}`, {
      method: 'PUT', token: venueManagerToken, body: { capacity: 60 },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.venue.capacity, 60);
    const denied = await api('/api/v1/admin/venues', {
      method: 'POST', token: userToken, body: { name: `Nope ${stamp}`, city: 'X', capacity: 5 },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'INSUFFICIENT_ROLE');
  });
  test('EVENT_MANAGER cannot manage venues (403)', async () => {
    const { status } = await api('/api/v1/admin/venues', {
      method: 'POST', token: eventManagerToken, body: { name: `Nope ${stamp}`, city: 'X', capacity: 5 },
    });
    assert.equal(status, 403);
  });
  test('seat CRUD: create, duplicate 409, update, delete', async () => {
    const created = await api(`/api/v1/admin/venues/${venueId}/seats`, {
      method: 'POST', token: venueManagerToken, body: { rowNumber: 'Z', seatNumber: '9', seatType: 'VIP' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.seat.label, 'Z9');
    const seatId = created.body.seat.id;
    const dup = await api(`/api/v1/admin/venues/${venueId}/seats`, {
      method: 'POST', token: venueManagerToken, body: { rowNumber: 'Z', seatNumber: '9' },
    });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.code, 'SEAT_ALREADY_EXISTS');
    const updated = await api(`/api/v1/admin/venues/${venueId}/seats/${seatId}`, {
      method: 'PUT', token: venueManagerToken, body: { seatType: 'PREMIUM' },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.seat.seatType, 'PREMIUM');
    const deleted = await api(`/api/v1/admin/venues/${venueId}/seats/${seatId}`, {
      method: 'DELETE', token: venueManagerToken,
    });
    assert.equal(deleted.status, 200);
    const gone = await api(`/api/v1/admin/venues/${venueId}/seats/${seatId}`, {
      method: 'PUT', token: venueManagerToken, body: { seatType: 'VIP' },
    });
    assert.equal(gone.status, 404);
  });
});
describe('admin shows', () => {
  test('EVENT_MANAGER creates a show, inventory auto-provisioned; USER 403', async () => {
    const t0 = Date.now() + 12 * 24 * 3600 * 1000;
    const created = await api('/api/v1/admin/shows', {
      method: 'POST', token: eventManagerToken,
      body: { eventId, venueId, startTime: new Date(t0).toISOString(), endTime: new Date(t0 + 7200000).toISOString(), defaultPrice: 200 },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.show.seats.total, 6);
    const denied = await api('/api/v1/admin/shows', {
      method: 'POST', token: userToken,
      body: { eventId, venueId, startTime: new Date(t0).toISOString(), endTime: new Date(t0 + 7200000).toISOString() },
    });
    assert.equal(denied.status, 403);
  });
  test('rejects bad times and duplicate slot', async () => {
    const t0 = Date.now() + 13 * 24 * 3600 * 1000;
    const s = new Date(t0).toISOString();
    const e = new Date(t0 + 7200000).toISOString();
    const bad = await api('/api/v1/admin/shows', {
      method: 'POST', token: eventManagerToken, body: { eventId, venueId, startTime: e, endTime: s },
    });
    assert.equal(bad.status, 400);
    const first = await api('/api/v1/admin/shows', {
      method: 'POST', token: eventManagerToken, body: { eventId, venueId, startTime: s, endTime: e },
    });
    assert.equal(first.status, 201);
    const dup = await api('/api/v1/admin/shows', {
      method: 'POST', token: eventManagerToken, body: { eventId, venueId, startTime: s, endTime: e },
    });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.code, 'SHOW_ALREADY_EXISTS');
  });
  test('rejects unknown event or venue with 404', async () => {
    const t0 = Date.now() + 14 * 24 * 3600 * 1000;
    const s = new Date(t0).toISOString();
    const e = new Date(t0 + 7200000).toISOString();
    const noEvent = await api('/api/v1/admin/shows', {
      method: 'POST', token: eventManagerToken, body: { eventId: 99999999, venueId, startTime: s, endTime: e },
    });
    assert.equal(noEvent.status, 404);
    const noVenue = await api('/api/v1/admin/shows', {
      method: 'POST', token: eventManagerToken, body: { eventId, venueId: 99999999, startTime: s, endTime: e },
    });
    assert.equal(noVenue.status, 404);
  });
});
after(async () => {
  await pool.execute('DELETE ss FROM show_seats ss JOIN shows s ON s.id = ss.show_id WHERE s.venue_id = ?', [venueId]);
  await pool.execute('DELETE FROM shows WHERE venue_id = ?', [venueId]);
  await pool.execute('DELETE FROM events WHERE id = ?', [eventId]);
  await pool.execute(`DELETE FROM events WHERE name LIKE '%${stamp}%'`);
  await pool.execute('DELETE FROM seats WHERE venue_id = ?', [venueId]);
  await pool.execute('DELETE FROM venues WHERE id = ?', [venueId]);
  await pool.execute(`DELETE FROM venues WHERE name LIKE '%${stamp}%'`);
  if (createdEmails.length) {
    const ph = createdEmails.map(() => '?').join(',');
    await pool.execute(`DELETE FROM users WHERE email IN (${ph})`, createdEmails);
  }
  await new Promise((r) => server.close(r));
  await closePool();
});
