'use strict';
// Request schemas for events (docs/04-api-design.md 4.3 + 4.8).
// Zod strips unknown keys by default.
const { z } = require('zod');
const EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ACTIVE', 'INACTIVE', 'CANCELLED'];
const PUBLIC_EVENT_STATUSES = ['PUBLISHED', 'ACTIVE'];
const pagingFields = {
  limit: z.coerce.number({ message: 'limit must be a number' }).int().min(1).max(100).optional(),
  offset: z.coerce
    .number({ message: 'offset must be a number' })
    .int()
    .min(0)
    .max(100000)
    .optional(),
};
// GET /api/v1/events?category=&search=&status=&limit=&offset=
const listEventsQuerySchema = z.object({
  category: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  status: z
    .enum(PUBLIC_EVENT_STATUSES, { message: 'status must be PUBLISHED or ACTIVE' })
    .optional(),
  ...pagingFields,
});
const eventIdParamSchema = z.object({
  id: z.coerce.number().int().positive('id must be a positive integer'),
});
const listShowsQuerySchema = z.object({ ...pagingFields });
const url = z.string().trim().max(500, 'posterUrl must be at most 500 characters');
const posterUrl = z
  .union([url.min(1, 'posterUrl must not be empty'), z.literal(''), z.null()])
  .optional();
// POST /api/v1/admin/events
const createEventSchema = z.object({
  name: z.string({ message: 'Name is required' }).trim().min(2).max(255),
  description: z.string().trim().max(65535).nullable().optional(),
  category: z.string().trim().min(1).max(100).nullable().optional(),
  posterUrl,
  status: z
    .enum(EVENT_STATUSES, { message: `status must be one of: ${EVENT_STATUSES.join(', ')}` })
    .optional(),
});
// PUT /api/v1/admin/events/:id (partial update, at least one field)
const updateEventSchema = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    description: z.string().trim().max(65535).nullable().optional(),
    category: z.string().trim().min(1).max(100).nullable().optional(),
    posterUrl,
    status: z
      .enum(EVENT_STATUSES, { message: `status must be one of: ${EVENT_STATUSES.join(', ')}` })
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });
// GET /api/v1/admin/events?status=&category=&search=&limit=&offset=
const listAdminEventsQuerySchema = z.object({
  status: z
    .enum(EVENT_STATUSES, { message: `status must be one of: ${EVENT_STATUSES.join(', ')}` })
    .optional(),
  category: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  ...pagingFields,
});
module.exports = {
  EVENT_STATUSES,
  PUBLIC_EVENT_STATUSES,
  listEventsQuerySchema,
  eventIdParamSchema,
  listShowsQuerySchema,
  createEventSchema,
  updateEventSchema,
  listAdminEventsQuerySchema,
};
