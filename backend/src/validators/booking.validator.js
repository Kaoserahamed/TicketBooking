'use strict';

/**
 * Request schemas for the bookings module (docs/04-api-design.md §4.5).
 */

const { z } = require('zod');
const { required } = require('./fields');

/** POST /api/v1/bookings/hold */
const holdBookingSchema = z.object({
  showId: z.number(required('Show ID'))
    .int('Show ID must be an integer')
    .positive('Show ID must be positive'),
  seatIds: z.array(z.number().int().positive(), {
    message: 'seatIds must be an array of seat IDs',
  })
    .min(1, 'At least one seat is required')
    .max(20, 'At most 20 seats can be held at once'),
  idempotencyKey: z.string().max(255).optional(),
});

/** GET /api/v1/bookings/:id — path param validated in route */
const bookingIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Booking ID must be a number'),
});

/** POST /api/v1/bookings/:id/cancel */
const cancelBookingParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Booking ID must be a number'),
});

/** GET /api/v1/users/me/bookings */
const listBookingsQuerySchema = z.object({
  status: z.enum(['PENDING', 'HOLDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED']).optional(),
  limit: z.coerce
    .number({ message: 'limit must be a number' })
    .int('limit must be an integer')
    .min(1, 'limit must be at least 1')
    .max(50, 'limit must be at most 50')
    .optional(),
  offset: z.coerce
    .number({ message: 'offset must be a number' })
    .int('offset must be an integer')
    .min(0, 'offset must be at least 0')
    .optional(),
});

module.exports = {
  holdBookingSchema,
  bookingIdParamSchema,
  cancelBookingParamSchema,
  listBookingsQuerySchema,
};
