'use strict';

/**
 * Route layer - admin endpoints (docs/04-api-design.md §4.8).
 *
 * Every route requires a valid access token AND an allowed role: RBAC is
 * enforced server-side, never by hiding frontend routes
 * (docs/11-security.md §11.1).
 */

const express = require('express');
const adminController = require('../controllers/admin.controller');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { listUsersQuerySchema } = require('../validators/auth.validator');
const {
  listAdminEventsQuerySchema,
  createEventSchema,
  updateEventSchema,
  eventIdParamSchema,
} = require('../validators/event.validator');
const {
  createVenueSchema,
  updateVenueSchema,
  venueIdParamSchema,
  createSeatSchema,
  updateSeatSchema,
  seatParamSchema,
} = require('../validators/venue.validator');
const { createShowSchema, updateShowSchema, showIdParamSchema } = require('../validators/show.validator');
const { listBookingsQuerySchema } = require('../validators/booking.validator');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

// GET /api/v1/admin/users?role=&status=&limit=
router.get(
  '/users',
  authenticate,
  authorize('ADMIN'),
  validate(listUsersQuerySchema, 'query'),
  asyncHandler(adminController.listUsers)
);

// GET /api/v1/admin/events?status=&category=&search=&limit=&offset=
router.get(
  '/events',
  authenticate,
  authorize('ADMIN', 'EVENT_MANAGER'),
  validate(listAdminEventsQuerySchema, 'query'),
  asyncHandler(adminController.adminListEvents)
);

// POST /api/v1/admin/events
router.post(
  '/events',
  authenticate,
  authorize('ADMIN', 'EVENT_MANAGER'),
  validate(createEventSchema),
  asyncHandler(adminController.adminCreateEvent)
);

// PUT /api/v1/admin/events/:id
router.put(
  '/events/:id',
  authenticate,
  authorize('ADMIN', 'EVENT_MANAGER'),
  validate(eventIdParamSchema, 'params'),
  validate(updateEventSchema),
  asyncHandler(adminController.adminUpdateEvent)
);

// POST /api/v1/admin/venues
router.post(
  '/venues',
  authenticate,
  authorize('ADMIN', 'VENUE_MANAGER'),
  validate(createVenueSchema),
  asyncHandler(adminController.adminCreateVenue)
);

// PUT /api/v1/admin/venues/:id
router.put(
  '/venues/:id',
  authenticate,
  authorize('ADMIN', 'VENUE_MANAGER'),
  validate(venueIdParamSchema, 'params'),
  validate(updateVenueSchema),
  asyncHandler(adminController.adminUpdateVenue)
);

// POST /api/v1/admin/venues/:id/seats
router.post(
  '/venues/:id/seats',
  authenticate,
  authorize('ADMIN', 'VENUE_MANAGER'),
  validate(venueIdParamSchema, 'params'),
  validate(createSeatSchema),
  asyncHandler(adminController.adminCreateSeat)
);

// PUT /api/v1/admin/venues/:id/seats/:seatId
router.put(
  '/venues/:id/seats/:seatId',
  authenticate,
  authorize('ADMIN', 'VENUE_MANAGER'),
  validate(seatParamSchema, 'params'),
  validate(updateSeatSchema),
  asyncHandler(adminController.adminUpdateSeat)
);

// DELETE /api/v1/admin/venues/:id/seats/:seatId
router.delete(
  '/venues/:id/seats/:seatId',
  authenticate,
  authorize('ADMIN', 'VENUE_MANAGER'),
  validate(seatParamSchema, 'params'),
  asyncHandler(adminController.adminDeleteSeat)
);

// POST /api/v1/admin/shows
router.post(
  '/shows',
  authenticate,
  authorize('ADMIN', 'EVENT_MANAGER'),
  validate(createShowSchema),
  asyncHandler(adminController.adminCreateShow)
);

// PUT /api/v1/admin/shows/:id
router.put(
  '/shows/:id',
  authenticate,
  authorize('ADMIN', 'EVENT_MANAGER'),
  validate(showIdParamSchema, 'params'),
  validate(updateShowSchema),
  asyncHandler(adminController.adminUpdateShow)
);

// GET /api/v1/admin/bookings?status=&limit=&offset= (ADMIN only)
router.get(
  '/bookings',
  authenticate,
  authorize('ADMIN'),
  validate(listBookingsQuerySchema, 'query'),
  asyncHandler(adminController.adminListBookings)
);

module.exports = router;