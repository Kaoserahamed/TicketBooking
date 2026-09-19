'use strict';

/**
 * Bookings API tests (node:test, run with `npm test`).
 * End-to-end: real Express app + real MySQL + real HTTP through the whole
 * stack (routes -> controller -> service -> repository -> MySQL).
 * Fixtures are stamped and cleaned up in `after()` so the suite is repeatable.
 * Each scenario holds a distinct set of seats so holds never interfere.
 */

process.env.NODE_ENV = 'test';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');

const createApp = require('../../src/app');
const { pool, closePool } = require('../../src/database/pool');
const { hashPassword } = require('../../src/utils/password');

const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PASSWORD = 'Secret123';
const userEmail = `booking.user.${stamp}@example.com`;
const otherEmail = `booking.other.${stamp}@example.com`;
const adminEmail = `booking.admin.${stamp}@example.com`;
const createdEmails = [userEmail, otherEmail, adminEmail];

let server;
let baseUrl;
let userToken;
let otherToken;
let adminToken;
let userId;
let venueId;
let eventId;
let showId;
const seatIds = [];

// POST an API request -> { status, body, text }.
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
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, body: json, text };
}

async function insertUser({ name, email, role }) {
  const [r] = await pool.execute(
    `INSERT INTO users (name, email, phone, password_hash, role, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
    [
      name,
      email,
      `8${String(Date.now()).slice(-9)}${Math.floor(Math.random() * 10)}`,
      await hashPassword(PASSWORD),
      role,
    ]
  );
  return Number(r.insertId);
}

async function login(email) {
  const { body } = await api('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });
  return body.tokens.accessToken;
}

// Printed label (e.g. "A1") for a physical seat id.
async function seatLabel(seatId) {
  const [r] = await pool.execute('SELECT `row_number`, seat_number FROM seats WHERE id = ?', [
    seatId,
  ]);
  return `${r[0].row_number}${r[0].seat_number}`;
}

// Live show_seats row for a seat in the seeded show.
async function showSeatRow(seatId) {
  const [r] = await pool.execute(
    'SELECT id, seat_id, status, booking_id FROM show_seats WHERE show_id = ? AND seat_id = ?',
    [showId, seatId]
  );
  return r[0];
}

// ---------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------
before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  userId = await insertUser({ name: 'Booking User', email: userEmail, role: 'USER' });
  await insertUser({ name: 'Other User', email: otherEmail, role: 'USER' });
  await insertUser({ name: 'Booking Admin', email: adminEmail, role: 'ADMIN' });
  userToken = await login(userEmail);
  otherToken = await login(otherEmail);
  adminToken = await login(adminEmail);

  // Venue with 11 seats. seats[0..9] provisioned into the show; seats[10] left
  // out of inventory to exercise "seat not part of this show".
  const [v] = await pool.execute(
    `INSERT INTO venues (name, address, city, capacity) VALUES (?, ?, ?, ?)`,
    [`Booking Venue ${stamp}`, '1 Booking St', 'Testville', 30]
  );
  venueId = Number(v.insertId);

  for (let i = 0; i < 11; i++) {
    const row = i < 6 ? 'A' : 'B';
    const num = String(i < 6 ? i + 1 : i - 5);
    const [s] = await pool.execute(
      `INSERT INTO seats (venue_id, \`row_number\`, seat_number, seat_type) VALUES (?, ?, ?, 'REGULAR')`,
      [venueId, row, num]
    );
    seatIds.push(Number(s.insertId));
  }

  const [e] = await pool.execute(
    `INSERT INTO events (name, description, category, status) VALUES (?, ?, ?, 'PUBLISHED')`,
    [`Booking Event ${stamp}`, 'Seeded for booking tests', 'Music']
  );
  eventId = Number(e.insertId);

  const [sh] = await pool.execute(
    `INSERT INTO shows (event_id, venue_id, start_time, end_time, status)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY),
            DATE_ADD(DATE_ADD(NOW(), INTERVAL 7 DAY), INTERVAL 2 HOUR), 'SCHEDULED')`,
    [eventId, venueId]
  );
  showId = Number(sh.insertId);

  const provisioned = seatIds.slice(0, 10);
  await pool.execute(
    `INSERT INTO show_seats (show_id, seat_id, price, status) VALUES ${provisioned.map(() => '(?, ?, ?, ?)').join(',')}`,
    provisioned.flatMap((sid) => [showId, sid, '100.00', 'AVAILABLE'])
  );
});

after(async () => {
  await pool.execute('DELETE FROM bookings WHERE show_id = ?', [showId]);
  await pool.execute('DELETE FROM show_seats WHERE show_id = ?', [showId]);
  await pool.execute('DELETE FROM shows WHERE id = ?', [showId]);
  await pool.execute('DELETE FROM events WHERE id = ?', [eventId]);
  await pool.execute('DELETE FROM seats WHERE venue_id = ?', [venueId]);
  await pool.execute('DELETE FROM venues WHERE id = ?', [venueId]);
  const ph = createdEmails.map(() => '?').join(',');
  await pool.execute(`DELETE FROM users WHERE email IN (${ph})`, createdEmails);
  await new Promise((resolve) => server.close(resolve));
  await closePool();
});

// ---------------------------------------------------------------
// Authentication & authorization
// ---------------------------------------------------------------
describe('booking authentication & authorization', () => {
  test('rejects unauthenticated POST /hold with 401', async () => {
    const { status, body } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      body: { showId, seatIds: [seatIds[0]] },
    });
    assert.equal(status, 401);
    assert.equal(body.code, 'MISSING_ACCESS_TOKEN');
  });

  test('rejects unauthenticated GET /:id with 401', async () => {
    const { status, body } = await api('/api/v1/bookings/1');
    assert.equal(status, 401);
    assert.equal(body.code, 'MISSING_ACCESS_TOKEN');
  });

  test('rejects unauthenticated GET /bookings (list) with 401', async () => {
    const { status, body } = await api('/api/v1/bookings');
    assert.equal(status, 401);
    assert.equal(body.code, 'MISSING_ACCESS_TOKEN');
  });

  test('rejects unauthenticated POST /:id/cancel with 401', async () => {
    const { status, body } = await api('/api/v1/bookings/1/cancel', { method: 'POST' });
    assert.equal(status, 401);
    assert.equal(body.code, 'MISSING_ACCESS_TOKEN');
  });

  test('a USER token cannot reach the admin bookings route (403)', async () => {
    const { status, body } = await api('/api/v1/admin/bookings', { token: userToken });
    assert.equal(status, 403);
    assert.equal(body.code, 'INSUFFICIENT_ROLE');
  });
});

// ---------------------------------------------------------------
// POST /api/v1/bookings/hold
// ---------------------------------------------------------------
describe('POST /api/v1/bookings/hold', () => {
  test('rejects an empty seatIds array with 400', async () => {
    const { status, body } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId, seatIds: [] },
    });
    assert.equal(status, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('rejects more than 20 seats with 400', async () => {
    const tooMany = Array.from({ length: 21 }, () => seatIds[0]);
    const { status, body } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId, seatIds: tooMany },
    });
    assert.equal(status, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('rejects a missing showId with 400', async () => {
    const { status } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { seatIds: [seatIds[0]] },
    });
    assert.equal(status, 400);
  });

  test('rejects a non-integer showId with 400', async () => {
    const { status } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId: 1.5, seatIds: [seatIds[0]] },
    });
    assert.equal(status, 400);
  });

  test('404s when the show does not exist (SHOW_NOT_FOUND)', async () => {
    const { status, body } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId: 99999999, seatIds: [seatIds[0]] },
    });
    assert.equal(status, 404);
    assert.equal(body.code, 'SHOW_NOT_FOUND');
  });

  test('404s when a seat is not part of the show (SEAT_NOT_IN_SHOW)', async () => {
    // seats[10] exists in the venue but was never provisioned as a show_seat.
    const { status, body } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId, seatIds: [seatIds[10]] },
    });
    assert.equal(status, 404);
    assert.equal(body.code, 'SEAT_NOT_IN_SHOW');
  });

  test('holds available seats (201) and locks them against another user (409)', async () => {
    const { status, body } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId, seatIds: [seatIds[2], seatIds[3]] },
    });
    assert.equal(status, 201);
    assert.equal(body.status, 'ok');
    assert.equal(body.idempotentReplay, false);
    assert.equal(body.booking.status, 'PENDING');
    assert.equal(body.booking.showId, showId);
    assert.equal(body.booking.userId, userId);
    assert.equal(body.booking.currency, 'INR');
    assert.equal(body.booking.subtotal, 200);
    assert.equal(body.booking.discount, 0);
    assert.equal(body.booking.totalAmount, 200);
    assert.match(body.booking.bookingReference, /^BK-/);
    assert.ok(body.booking.expiresAt);
    assert.equal(body.booking.show.event.status, 'PUBLISHED');
    assert.equal(body.items.length, 2);
    assert.ok(body.items.every((it) => it.price === 100));
    assert.ok(body.items.every((it) => it.seat.seatType === 'REGULAR'));
    const want = [await seatLabel(seatIds[2]), await seatLabel(seatIds[3])];
    assert.ok(body.items.every((it) => want.includes(it.seat.label)));

    const { status: conflictStatus, body: conflictBody } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: otherToken,
      body: { showId, seatIds: [seatIds[2], seatIds[3]] },
    });
    assert.equal(conflictStatus, 409);
    assert.equal(conflictBody.code, 'SEATS_UNAVAILABLE');
  });

  test('replays a duplicate idempotency key (200, idempotentReplay)', async () => {
    const key = `idem-${stamp}`;
    const first = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId, seatIds: [seatIds[0], seatIds[1]], idempotencyKey: key },
    });
    assert.equal(first.status, 201);
    assert.equal(first.body.idempotentReplay, false);

    const second = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId, seatIds: [seatIds[0], seatIds[1]], idempotencyKey: key },
    });
    assert.equal(second.status, 200);
    assert.equal(second.body.idempotentReplay, true);
    assert.equal(second.body.booking.id, first.body.booking.id);
    assert.equal(second.body.booking.bookingReference, first.body.booking.bookingReference);
  });

  test('idempotency key is scoped per user', async () => {
    const key = `idem-other-${stamp}`;
    const first = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId, seatIds: [seatIds[4]], idempotencyKey: key },
    });
    assert.equal(first.status, 201);

    // Same key, different user -> not a replay; the seat is already HELD so 409.
    const sameKey = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: otherToken,
      body: { showId, seatIds: [seatIds[4]], idempotencyKey: key },
    });
    assert.equal(sameKey.status, 409);
    assert.equal(sameKey.body.code, 'SEATS_UNAVAILABLE');
    assert.equal(sameKey.body.idempotentReplay, undefined);
  });
});

// ---------------------------------------------------------------
// GET /api/v1/bookings/:id
// ---------------------------------------------------------------
describe('GET /api/v1/bookings/:id', () => {
  let bookingId;

  before(async () => {
    const { body } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId, seatIds: [seatIds[5]] },
    });
    bookingId = body.booking.id;
  });

  test('returns a booking for its owner (200)', async () => {
    const { status, body } = await api(`/api/v1/bookings/${bookingId}`, { token: userToken });
    assert.equal(status, 200);
    assert.equal(body.booking.id, bookingId);
    assert.equal(body.booking.status, 'PENDING');
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].seat.label, await seatLabel(seatIds[5]));
    assert.equal(body.items[0].price, 100);
  });

  test('allows an ADMIN to view any booking (200)', async () => {
    const { status } = await api(`/api/v1/bookings/${bookingId}`, { token: adminToken });
    assert.equal(status, 200);
  });

  test('forbids another USER from viewing the booking (403)', async () => {
    const { status, body } = await api(`/api/v1/bookings/${bookingId}`, { token: otherToken });
    assert.equal(status, 403);
    assert.equal(body.code, 'INSUFFICIENT_ROLE');
  });

  test('404s for a missing booking', async () => {
    const { status, body } = await api('/api/v1/bookings/99999999', { token: userToken });
    assert.equal(status, 404);
    assert.equal(body.code, 'BOOKING_NOT_FOUND');
  });

  test('rejects a non-numeric id with 400', async () => {
    const { status, body } = await api('/api/v1/bookings/abc', { token: userToken });
    assert.equal(status, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------
// POST /api/v1/bookings/:id/cancel
// ---------------------------------------------------------------
describe('POST /api/v1/bookings/:id/cancel', () => {
  test('cancels a PENDING booking and releases the hold (200)', async () => {
    const { body: held } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId, seatIds: [seatIds[6]] },
    });
    const id = held.booking.id;

    const { status, body } = await api(`/api/v1/bookings/${id}/cancel`, {
      method: 'POST',
      token: userToken,
    });
    assert.equal(status, 200);
    assert.equal(body.booking.status, 'CANCELLED');
    assert.equal(body.released, 1);
    assert.equal(body.items.length, 1);

    // The seat must be back to AVAILABLE with no booking link.
    const row = await showSeatRow(seatIds[6]);
    assert.equal(row.status, 'AVAILABLE');
    assert.equal(row.booking_id, null);
  });

  test('forbids another USER from cancelling (403)', async () => {
    const { body: held } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId, seatIds: [seatIds[7]] },
    });
    const id = held.booking.id;

    const { status, body } = await api(`/api/v1/bookings/${id}/cancel`, {
      method: 'POST',
      token: otherToken,
    });
    assert.equal(status, 403);
    assert.equal(body.code, 'INSUFFICIENT_ROLE');

    // The owner can still cancel it afterwards.
    const { status: cancelled } = await api(`/api/v1/bookings/${id}/cancel`, {
      method: 'POST',
      token: userToken,
    });
    assert.equal(cancelled, 200);
  });

  test('rejects cancelling a CONFIRMED booking (409)', async () => {
    const { body: held } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId, seatIds: [seatIds[8]] },
    });
    const id = held.booking.id;
    await pool.execute(`UPDATE bookings SET status = 'CONFIRMED' WHERE id = ?`, [id]);

    const { status, body } = await api(`/api/v1/bookings/${id}/cancel`, {
      method: 'POST',
      token: userToken,
    });
    assert.equal(status, 409);
    assert.equal(body.code, 'BOOKING_ALREADY_CONFIRMED');

    // Seats must still be HELD (release never ran).
    const row = await showSeatRow(seatIds[8]);
    assert.equal(row.status, 'HELD');
  });

  test('404s for a missing booking', async () => {
    const { status, body } = await api('/api/v1/bookings/99999999/cancel', {
      method: 'POST',
      token: userToken,
    });
    assert.equal(status, 404);
    assert.equal(body.code, 'BOOKING_NOT_FOUND');
  });

  test('rejects a non-numeric id with 400', async () => {
    const { status, body } = await api('/api/v1/bookings/abc/cancel', {
      method: 'POST',
      body: {},
      token: userToken,
    });
    assert.equal(status, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------
// GET /api/v1/bookings (my bookings)
// ---------------------------------------------------------------
describe('GET /api/v1/bookings (my bookings)', () => {
  let myBookingRef;

  before(async () => {
    const { body } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId, seatIds: [seatIds[9]] },
    });
    myBookingRef = body.booking.bookingReference;
  });

  test('lists the user bookings with a status filter', async () => {
    const { status, body } = await api('/api/v1/bookings?status=PENDING', { token: userToken });
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.total, 'number');
    assert.ok(Array.isArray(body.bookings));
    assert.ok(body.bookings.some((b) => b.bookingReference === myBookingRef));
    assert.equal(body.total, body.bookings.length);
    assert.ok(body.bookings.every((b) => b.status === 'PENDING'));
  });

  test('paginates with limit and offset', async () => {
    const { status, body } = await api('/api/v1/bookings?status=PENDING&limit=1&offset=0', {
      token: userToken,
    });
    assert.equal(status, 200);
    assert.equal(body.bookings.length, 1);
    assert.ok(body.total >= 1);
  });

  test('rejects a non-numeric limit with 400', async () => {
    const { status, body } = await api('/api/v1/bookings?limit=abc', { token: userToken });
    assert.equal(status, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('an ADMIN can list every user booking', async () => {
    const { status, body } = await api('/api/v1/bookings?status=PENDING', { token: adminToken });
    assert.equal(status, 200);
    assert.ok(body.total >= 1);
    assert.ok(body.bookings.some((b) => b.bookingReference === myBookingRef));
  });
});

// ---------------------------------------------------------------
// GET /api/v1/admin/bookings
// ---------------------------------------------------------------
describe('GET /api/v1/admin/bookings', () => {
  let adminBookingId;
  let adminBookingRef;

  before(async () => {
    const { body } = await api('/api/v1/bookings/hold', {
      method: 'POST',
      token: userToken,
      body: { showId, seatIds: [seatIds[6]] },
    });
    adminBookingId = body.booking.id;
    adminBookingRef = body.booking.bookingReference;
  });

  test('returns 401 without a token', async () => {
    const { status, body } = await api('/api/v1/admin/bookings');
    assert.equal(status, 401);
    assert.equal(body.code, 'MISSING_ACCESS_TOKEN');
  });

  test('returns 403 for a USER token', async () => {
    const { status, body } = await api('/api/v1/admin/bookings', { token: otherToken });
    assert.equal(status, 403);
    assert.equal(body.code, 'INSUFFICIENT_ROLE');
  });

  test('returns 200 with all bookings for an ADMIN', async () => {
    const { status, body } = await api('/api/v1/admin/bookings', { token: adminToken });
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.ok(Array.isArray(body.bookings));
    assert.equal(body.total, body.bookings.length);
    assert.ok(body.bookings.some((b) => b.bookingReference === adminBookingRef));
  });

  test('filters by status', async () => {
    const { status, body } = await api('/api/v1/admin/bookings?status=PENDING', {
      token: adminToken,
    });
    assert.equal(status, 200);
    assert.ok(body.bookings.some((b) => b.bookingReference === adminBookingRef));
    assert.ok(body.bookings.every((b) => b.status === 'PENDING'));
  });

  test('reflects a CANCELLED booking in the CANCELLED filter', async () => {
    const { status } = await api(`/api/v1/bookings/${adminBookingId}/cancel`, {
      method: 'POST',
      token: userToken,
    });
    assert.equal(status, 200);

    const { status: listed, body } = await api('/api/v1/admin/bookings?status=CANCELLED&limit=1', {
      token: adminToken,
    });
    assert.equal(listed, 200);
    assert.equal(body.bookings.length, 1);
    assert.equal(body.bookings[0].bookingReference, adminBookingRef);
    assert.equal(body.bookings[0].status, 'CANCELLED');
  });

  test('rejects an invalid status filter with 400', async () => {
    const { status, body } = await api('/api/v1/admin/bookings?status=NOPE', { token: adminToken });
    assert.equal(status, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });
});
