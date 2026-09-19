'use strict';

/** Repository layer - show_seats transactional write operations.
 *
 * Seat holds/releases are the heart of the double-booking guard
 * (docs/05-domain-booking.md §5.3 - Atomic Seat Reservation). They run inside a
 * caller-provided MySQL connection so the whole hold flow is one unit of work.
 *
 * Read paths stay in src/repositories/show.repository.js; this module owns writes.
 */

/** Atomically move AVAILABLE seats into HELD inside one show.
 *
 * @param {import('mysql2/promise').Connection} conn
 * @param {number} showId
 * @param {number[]} seatIds
 * @param {string} holdToken
 * @param {Date} holdExpiresAt
 * @returns {Promise<{held: number, prices: object[]}>} held = rows affected
 */
async function holdSeats(conn, showId, seatIds, holdToken, holdExpiresAt) {
  const [upd] = await conn.execute(
    `UPDATE show_seats
        SET status = 'HELD', hold_token = ?, hold_expires_at = ?, booking_id = NULL
      WHERE show_id = ? AND seat_id IN (${seatIds.map(() => '?').join(',')}) AND status = 'AVAILABLE'`,
    [holdToken, holdExpiresAt.toISOString().slice(0, 19).replace('T', ' '), showId, ...seatIds]
  );

  const held = Number(upd.affectedRows);

  // Read prices in the same txn so the booking_items totals match what was held.
  const [prices] = await conn.execute(
    `SELECT ss.id AS show_seat_id, ss.price, ss.status, s.row_number, s.seat_number
       FROM show_seats ss
       JOIN seats s ON s.id = ss.seat_id
      WHERE ss.show_id = ? AND ss.seat_id IN (${seatIds.map(() => '?').join(',')})`,
    [showId, ...seatIds]
  );

  return { held, prices };
}

/** Release every seat tied to a booking back to AVAILABLE.
 *
 * @param {import('mysql2/promise').Connection} conn
 * @param {number} bookingId
 * @returns {Promise<number>} seats released
 */
async function releaseSeats(conn, bookingId) {
  const [upd] = await conn.execute(
    `UPDATE show_seats
        SET status = 'AVAILABLE', hold_token = NULL, hold_expires_at = NULL, booking_id = NULL
      WHERE booking_id = ? AND status IN ('HELD', 'BOOKED')`,
    [bookingId]
  );
  return Number(upd.affectedRows);
}

/** Link show_seats to a booking after the booking row exists. */
async function linkSeatsToBooking(conn, showId, seatIds, bookingId) {
  const [upd] = await conn.execute(
    `UPDATE show_seats SET booking_id = ? WHERE show_id = ? AND seat_id IN (${seatIds.map(() => '?').join(',')})`,
    [bookingId, showId, ...seatIds]
  );
  return Number(upd.affectedRows);
}

/** Generate a booking reference like BK-1730000000000-AbCd. */
function generateReference() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BK-${ts}-${rnd}`;
}

module.exports = { holdSeats, releaseSeats, linkSeatsToBooking, generateReference };
