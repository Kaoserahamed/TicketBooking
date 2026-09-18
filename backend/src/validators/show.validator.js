'use strict';
// Request schemas for shows/schedules (docs/04-api-design.md 4.3-4.4).
const { z } = require('zod');
const SHOW_STATUSES = ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'];
const pagingFields = {
  limit: z.coerce.number({ message: 'limit must be a number' }).int().min(1).max(100).optional(),
  offset: z.coerce.number({ message: 'offset must be a number' }).int().min(0).max(100000).optional(),
};
const dateTime = z.string({ message: 'must be a datetime string' }).trim().min(1, 'must not be empty').refine((v) => !Number.isNaN(new Date(v).getTime()), { message: 'must be a valid datetime' });
// GET /api/v1/shows?eventId=&venueId=&status=&upcoming=&limit=&offset=
const listShowsQuerySchema = z.object({
  eventId: z.coerce.number().int().positive().optional(),
  venueId: z.coerce.number().int().positive().optional(),
  status: z.enum(SHOW_STATUSES, { message: `status must be one of: ${SHOW_STATUSES.join(', ')}` }).optional(),
  upcoming: z.coerce.boolean().optional(),
  ...pagingFields,
});
const showIdParamSchema = z.object({ id: z.coerce.number().int().positive('id must be a positive integer') });
// POST /api/v1/admin/shows
const createShowSchema = z.object({
  eventId: z.number({ message: 'eventId is required' }).int().positive(),
  venueId: z.number({ message: 'venueId is required' }).int().positive(),
  startTime: dateTime,
  endTime: dateTime,
  status: z.enum(SHOW_STATUSES, { message: `status must be one of: ${SHOW_STATUSES.join(', ')}` }).optional(),
  provisionInventory: z.boolean().optional(),
  defaultPrice: z.number().min(0, 'defaultPrice must be >= 0').max(1000000, 'defaultPrice is too large').optional(),
});
// PUT /api/v1/admin/shows/:id (event/venue are immutable - times/status only)
const updateShowSchema = z.object({
  startTime: dateTime.optional(),
  endTime: dateTime.optional(),
  status: z.enum(SHOW_STATUSES, { message: `status must be one of: ${SHOW_STATUSES.join(', ')}` }).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });
module.exports = { SHOW_STATUSES, listShowsQuerySchema, showIdParamSchema, createShowSchema, updateShowSchema };
