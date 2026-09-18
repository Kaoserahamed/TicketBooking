'use strict';
// Request schemas for venues + seat layout (docs/02-system-architecture.md 2.4).
const { z } = require('zod');
const SEAT_TYPES = ['REGULAR', 'VIP', 'PREMIUM', 'BALCONY', 'BOX'];
const pagingFields = {
  limit: z.coerce.number({ message: 'limit must be a number' }).int().min(1).max(500).optional(),
  offset: z.coerce.number({ message: 'offset must be a number' }).int().min(0).max(100000).optional(),
};
// GET /api/v1/venues?city=&search=&limit=&offset=
const listVenuesQuerySchema = z.object({
  city: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  ...pagingFields,
});
const venueIdParamSchema = z.object({ id: z.coerce.number().int().positive('id must be a positive integer') });
// POST /api/v1/admin/venues
const createVenueSchema = z.object({
  name: z.string({ message: 'Name is required' }).trim().min(2).max(255),
  address: z.string().trim().max(65535).nullable().optional(),
  city: z.string({ message: 'City is required' }).trim().min(1).max(100),
  capacity: z.number({ message: 'capacity must be a number' }).int('capacity must be an integer').min(1, 'capacity must be at least 1').max(1000000, 'capacity is too large'),
});
// PUT /api/v1/admin/venues/:id
const updateVenueSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  address: z.string().trim().max(65535).nullable().optional(),
  city: z.string().trim().min(1).max(100).optional(),
  capacity: z.number().int().min(1).max(1000000).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });
// GET /api/v1/venues/:id/seats?seatType=&limit=&offset=
const listSeatsQuerySchema = z.object({
  seatType: z.enum(SEAT_TYPES, { message: `seatType must be one of: ${SEAT_TYPES.join(', ')}` }).optional(),
  ...pagingFields,
});
const seatParamSchema = z.object({
  id: z.coerce.number().int().positive('id must be a positive integer'),
  seatId: z.coerce.number().int().positive('seatId must be a positive integer'),
});
// POST /api/v1/admin/venues/:id/seats
const createSeatSchema = z.object({
  rowNumber: z.string({ message: 'rowNumber is required' }).trim().min(1).max(10),
  seatNumber: z.string({ message: 'seatNumber is required' }).trim().min(1).max(10),
  seatType: z.enum(SEAT_TYPES, { message: `seatType must be one of: ${SEAT_TYPES.join(', ')}` }).optional(),
});
// PUT /api/v1/admin/venues/:id/seats/:seatId
const updateSeatSchema = z.object({
  seatType: z.enum(SEAT_TYPES, { message: `seatType must be one of: ${SEAT_TYPES.join(', ')}` }),
});
module.exports = { SEAT_TYPES, listVenuesQuerySchema, venueIdParamSchema, createVenueSchema, updateVenueSchema, listSeatsQuerySchema, seatParamSchema, createSeatSchema, updateSeatSchema };
