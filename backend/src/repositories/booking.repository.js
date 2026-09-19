'use strict';

/**
 * Repository layer - booking_items + bookings reads.
 * Write paths (hold/create/cancel) are intentionally transactional and live in
 * src/services/booking.service.js so the whole hold flow is one unit of work.
 *
 * docs/03-database-design.md 3.7-3.9, docs/04-api-design.md 4.5.
 */

const { pool } = require('../database/pool');

const BOOKING_COLUMNS =
  'b.id, b.user_id, b.show_id, b.booking_reference, b.idempotency_key, ' +
  'b.status, b.subtotal, b.discount, b.total_amount, b.currency, ' +
  'b.expires_at, b.created_at, b.updated_at';

/**
 * Full booking detail joined to the show + event + venue.
 */
async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT
        ${BOOKING_COLUMNS},
        s.event_id, s.venue_id,
        s.start_time AS show_start_time, s.end_time AS show_end_time, s.status AS show_status,
        e.name   AS event_name, e.description AS event_description, e.category, e.status AS event_status,
        v.name   AS venue_name, v.address AS venue_address, v.city AS venue_city, v.capacity AS venue_capacity
      FROM bookings b
      JOIN shows s ON s.id = b.show_id
      JOIN events e ON e.id = s.event_id
      JOIN venues v ON v.id = s.venue_id
      WHERE b.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

/** Look up by the public booking reference. */
async function findByReference(reference) {
  const [rows] = await pool.execute(
    `SELECT ${BOOKING_COLUMNS} FROM bookings b WHERE b.booking_reference = ? LIMIT 1`,
    [reference]
  );
  return rows[0] ?? null;
}

/**
 * Idempotency guard: has this user already placed a hold with this key?
 */
async function findByUserIdAndIdempotencyKey(userId, idempotencyKey) {
  const [rows] = await pool.execute(
    'SELECT id FROM bookings WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
    [userId, idempotencyKey]
  );
  return rows[0] ?? null;
}

/** Every booking for a user, newest first. */
async function findByUser(userId, filters = {}) {
  const params = [userId];
  const countParams = [userId];
  const conditions = ['user_id = ?'];
  const countWhere = ['user_id = ?'];
  if (filters.status) {
    conditions.push('b.status = ?');
    params.push(filters.status);
    countWhere.push('status = ?');
    countParams.push(filters.status);
  }
  const limit = Number.isInteger(filters.limit) ? filters.limit : 20;
  const offset = Number.isInteger(filters.offset) ? filters.offset : 0;
  const [rows] = await pool.execute(
    `SELECT ${BOOKING_COLUMNS}, s.event_id, s.venue_id,
            s.start_time AS show_start_time, s.end_time AS show_end_time, s.status AS show_status,
            e.name AS event_name, e.category, e.status AS event_status,
            v.name AS venue_name, v.city
      FROM bookings b
      JOIN shows s ON s.id = b.show_id
      JOIN events e ON e.id = s.event_id
      JOIN venues v ON v.id = s.venue_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [c] = await pool.execute(
    'SELECT COUNT(*) AS total FROM bookings WHERE ' + countWhere.join(' AND '),
    countParams
  );
  return { rows, total: Number(c[0].total) };
}

/** Admin: every booking, with optional status filter. */
async function listAll(filters = {}) {
  const params = [];
  const countParams = [];
  const conditions = [];
  const countWhere = [];
  if (filters.status) {
    conditions.push('b.status = ?');
    params.push(filters.status);
    countWhere.push('status = ?');
    countParams.push(filters.status);
  }
  const limit = Number.isInteger(filters.limit) ? filters.limit : 50;
  const offset = Number.isInteger(filters.offset) ? filters.offset : 0;
  const [rows] = await pool.execute(
    `SELECT ${BOOKING_COLUMNS}, s.event_id, s.venue_id,
            s.start_time AS show_start_time, s.end_time AS show_end_time, s.status AS show_status,
            e.name AS event_name, e.category, e.status AS event_status,
            v.name AS venue_name, v.city,
            u.name AS user_name, u.email AS user_email
      FROM bookings b
      JOIN shows s ON s.id = b.show_id
      JOIN events e ON e.id = s.event_id
      JOIN venues v ON v.id = s.venue_id
      JOIN users u ON u.id = b.user_id
      ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [c] = await pool.execute(
    'SELECT COUNT(*) AS total FROM bookings' +
      (countWhere.length ? ' WHERE ' + countWhere.join(' AND ') : ''),
    countParams
  );
  return { rows, total: Number(c[0].total) };
}

/**
 * Booking items with joined seat info for a booking id.
 */
async function findItemsByBookingId(bookingId) {
  const [rows] = await pool.execute(
    `SELECT bi.id, bi.booking_id, bi.show_seat_id, bi.price,
            s.id AS seat_id, s.row_number, s.seat_number, s.seat_type
      FROM booking_items bi
      JOIN show_seats ss ON ss.id = bi.show_seat_id
      JOIN seats s ON s.id = ss.seat_id
      WHERE bi.booking_id = ?`,
    [bookingId]
  );
  return rows;
}

/** Seat prices for the requested show_seat ids inside a show. */
async function getSeatPrices(showId, seatIds) {
  const [rows] = await pool.execute(
    `SELECT ss.id AS show_seat_id, ss.price, ss.status
      FROM show_seats ss
      WHERE ss.show_id = ? AND ss.seat_id IN (${seatIds.map(() => '?').join(',')})`,
    [showId, ...seatIds]
  );
  return rows;
}

/**
 * Grab a connection so the hold flow can run in one transaction.
 * Caller is responsible for `conn.release()` (usually via try/finally).
 */
async function getConnection() {
  return pool.getConnection();
}

module.exports = {
  findById,
  findByReference,
  findByUserIdAndIdempotencyKey,
  findByUser,
  listAll,
  findItemsByBookingId,
  getSeatPrices,
  getConnection,
};
