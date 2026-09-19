'use strict';

/** Route layer - bookings (docs/04-api-design.md §4.5).
 *
 * Mounted at /api/v1/bookings by src/app.js. All routes require a valid
 * access token. The admin bookings monitor route lives under /api/v1/admin.
 */

const express = require('express');
const c = require('../controllers/booking.controller');
const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const {
  holdBookingSchema,
  bookingIdParamSchema,
  cancelBookingParamSchema,
  listBookingsQuerySchema,
} = require('../validators/booking.validator');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

// POST /api/v1/bookings/hold — hold seats (idempotency via Idempotency-Key)
router.post(
  '/hold',
  authenticate,
  validate(holdBookingSchema),
  asyncHandler(c.holdBooking)
);

// GET /api/v1/bookings/:id — own booking or admin
router.get(
  '/:id',
  authenticate,
  validate(bookingIdParamSchema, 'params'),
  asyncHandler(c.getBooking)
);

// POST /api/v1/bookings/:id/cancel — release held seats
router.post(
  '/:id/cancel',
  authenticate,
  validate(cancelBookingParamSchema, 'params'),
  asyncHandler(c.cancelBooking)
);

// GET /api/v1/users/me/bookings — user's own booking history
// NOTE: this is mounted on the bookings router because the path matches
// /api/v1/bookings. The "me" shortcut is resolved by the controller.
router.get(
  '/',
  authenticate,
  validate(listBookingsQuerySchema, 'query'),
  asyncHandler(c.listMyBookings)
);

module.exports = router;
