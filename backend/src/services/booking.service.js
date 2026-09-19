'use strict';

/** Service layer - bookings (hold, cancel, read).
 *
 * Implements docs/05-domain-booking.md §5.3 (atomic seat reservation) and
 * docs/04-api-design.md §4.5. All SQL is parameterized and the hold + booking
 * creation run in one transaction so either everything lands or nothing does.
 */

const bookingRepository = require('../repositories/booking.repository');
const showSeatRepository = require('../repositories/show-seat.repository');
const { ValidationError, NotFoundError, ConflictError, ForbiddenError } = require('../utils/errors');
const { toBooking, toBookingItem } = require('../utils/serialize');

const CANCELLABLE = new Set(['PENDING', 'HOLDING']);

/** Create a seat hold. One transaction, atomic seat locking, idempotent replay.
 *
 * @param {{id: number, role: string}} user
 * @param {{showId: number, seatIds: number[], idempotencyKey?: string}} input
 * @returns {Promise<{booking: object, items: object[], idempotentReplay: boolean}>}
 */
async function holdBooking(user, input) {
  const { showId, seatIds, idempotencyKey } = input;

  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw new ValidationError('At least one seat must be selected', [{ field: 'seatIds', message: 'At least one seat is required' }]);
  }
  if (seatIds.length > 20) {
    throw new ValidationError('At most 20 seats can be held at once', [{ field: 'seatIds', message: 'At most 20 seats can be held at once' }]);
  }

  let conn;
  try {
    conn = await bookingRepository.getConnection();
    await conn.beginTransaction();

    if (idempotencyKey) {
      const existing = await bookingRepository.findByUserIdAndIdempotencyKey(user.id, idempotencyKey);
      if (existing) {
        const booking = await bookingRepository.findById(existing.id);
        if (!booking) throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
        const items = await bookingRepository.findItemsByBookingId(booking.id);
        await conn.rollback();
        return { booking: toBooking(booking, items), items: items.map(toBookingItem), idempotentReplay: true };
      }
    }

    const [showRows] = await conn.execute('SELECT id, status FROM shows WHERE id = ? LIMIT 1', [showId]);
    if (!showRows[0]) throw new NotFoundError('Show not found', 'SHOW_NOT_FOUND');

    const ph = seatIds.map(() => '?').join(',');
    const [seatRows] = await conn.execute(
      `SELECT ss.id, ss.seat_id, ss.status FROM show_seats ss WHERE ss.show_id = ? AND ss.seat_id IN (${ph})`,
      [showId, ...seatIds]
    );
    const found = new Set(seatRows.map((r) => r.seat_id));
    for (const sid of seatIds) {
      if (!found.has(sid)) throw new NotFoundError(`Seat ${sid} is not part of this show`, 'SEAT_NOT_IN_SHOW');
    }

    const holdToken = `hold-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const { held, prices } = await showSeatRepository.holdSeats(conn, showId, seatIds, holdToken, holdExpiresAt);
    if (held !== seatIds.length) {
      await conn.rollback();
      throw new ConflictError('One or more seats are no longer available', 'SEATS_UNAVAILABLE');
    }

    const subtotal = prices.reduce((s, p) => s + Number(p.price), 0);
    const bookingRef = showSeatRepository.generateReference();
    const [ins] = await conn.execute(
      `INSERT INTO bookings (user_id, show_id, booking_reference, idempotency_key, status, subtotal, discount, total_amount, currency, expires_at)
        VALUES (?, ?, ?, ?, 'PENDING', ?, 0.00, ?, 'INR', ?)`,
          [user.id, showId, bookingRef, idempotencyKey || null, subtotal, subtotal, holdExpiresAt.toISOString().slice(0, 19).replace('T', ' ')]
    );
    const bookingId = Number(ins.insertId);

    for (const p of prices) {
      await conn.execute('INSERT INTO booking_items (booking_id, show_seat_id, price) VALUES (?, ?, ?)', [bookingId, p.show_seat_id, p.price]);
    }
    await showSeatRepository.linkSeatsToBooking(conn, showId, seatIds, bookingId);
    await conn.commit();

    const booking = await bookingRepository.findById(bookingId);
    const items = await bookingRepository.findItemsByBookingId(bookingId);
    return { booking: toBooking(booking, items), items: items.map(toBookingItem), idempotentReplay: false };
  } catch (error) {
    if (conn && conn.destroyed === false) { try { await conn.rollback(); } catch {} }
    throw error;
  } finally {
    if (conn) { try { await conn.release(); } catch {} }
  }
}

async function getBooking(user, bookingId) {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking) throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');

  const isAdmin = user.role === 'ADMIN';
  if (!isAdmin && Number(booking.user_id) !== Number(user.id)) {
    throw new ForbiddenError('You may only view your own bookings', 'INSUFFICIENT_ROLE');
  }

  const items = await bookingRepository.findItemsByBookingId(booking.id);
  return { booking: toBooking(booking, items), items: items.map(toBookingItem) };
}

/**
 * Cancel a PENDING/HOLDING booking and release the held seats.
 *
 * @param {{id: number, role: string}} user
 * @param {number} bookingId
 * @returns {Promise<{booking: object, items: object[], released: number}>}
 */
async function cancelBooking(user, bookingId) {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking) throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');

  if (!CANCELLABLE.has(booking.status)) {
    throw new ConflictError(
      `Booking ${booking.status} cannot be cancelled`,
      'BOOKING_ALREADY_CONFIRMED'
    );
  }

  const isAdmin = user.role === 'ADMIN';
  if (!isAdmin && Number(booking.user_id) !== Number(user.id)) {
    throw new ForbiddenError('You may only cancel your own bookings', 'INSUFFICIENT_ROLE');
  }

  let conn;
  try {
    conn = await bookingRepository.getConnection();
    await conn.beginTransaction();

    const released = await showSeatRepository.releaseSeats(conn, bookingId);

    await conn.execute(
      `UPDATE bookings SET status = 'CANCELLED' WHERE id = ?`,
      [bookingId]
    );

    await conn.commit();

    const refreshed = await bookingRepository.findById(bookingId);
    const items = await bookingRepository.findItemsByBookingId(bookingId);
    return {
      booking: toBooking(refreshed, items),
      items: items.map(toBookingItem),
      released,
    };
  } catch (error) {
    if (conn && conn.destroyed === false) { try { await conn.rollback(); } catch {} }
    throw error;
  } finally {
    if (conn) { try { await conn.release(); } catch {} }
  }
}

/** A user's own bookings, newest first. Admins see all bookings via this endpoint too. */
async function listBookings(user, filters = {}) {
  if (user.role === 'ADMIN') {
    const result = await bookingRepository.listAll(filters);
    return {
      bookings: result.rows.map((r) => toBooking(r)),
      total: result.total,
    };
  }
  const result = await bookingRepository.findByUser(user.id, filters);
  return {
    bookings: result.rows.map((r) => toBooking(r)),
    total: result.total,
  };
}

/** Admin: every booking with optional status filter. */
async function listBookingsAdmin(filters = {}) {
  const result = await bookingRepository.listAll(filters);
  return {
    bookings: result.rows.map((r) => toBooking(r)),
    total: result.total,
  };
}

module.exports = { holdBooking, cancelBooking, getBooking, listBookings, listBookingsAdmin };