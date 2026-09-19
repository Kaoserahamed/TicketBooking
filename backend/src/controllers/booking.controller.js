'use strict';

/** Controller layer - bookings (HTTP translation only). */

const bookingService = require('../services/booking.service');

/** POST /api/v1/bookings/hold */
async function holdBooking(req, res) {
  const { booking, items, idempotentReplay } = await bookingService.holdBooking(req.user, req.body);
  res.status(idempotentReplay ? 200 : 201).json({
    status: 'ok',
    booking,
    items,
    idempotentReplay,
  });
}

/** GET /api/v1/bookings/:id */
async function getBooking(req, res) {
  const { booking, items } = await bookingService.getBooking(
    req.user,
    Number(req.validatedParams.id)
  );
  res.json({ status: 'ok', booking, items });
}

/** POST /api/v1/bookings/:id/cancel */
async function cancelBooking(req, res) {
  const { booking, items, released } = await bookingService.cancelBooking(
    req.user,
    Number(req.validatedParams.id)
  );
  res.json({
    status: 'ok',
    booking,
    items,
    released,
    message: 'Booking cancelled and seats released',
  });
}

/** GET /api/v1/users/me/bookings */
async function listMyBookings(req, res) {
  const filters = req.validatedQuery || {};
  const { bookings, total } = await bookingService.listBookings(req.user, filters);
  res.json({ status: 'ok', total, bookings });
}

module.exports = { holdBooking, getBooking, cancelBooking, listMyBookings };
