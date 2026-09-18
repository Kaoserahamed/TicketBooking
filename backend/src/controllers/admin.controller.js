'use strict';

/**
 * Controller layer - admin endpoints (docs/04-api-design.md §4.8).
 */

const userService = require('../services/user.service');
const eventService = require('../services/event.service');

/** GET /api/v1/admin/users */
async function listUsers(req, res) {
  const filters = req.validatedQuery || {};
  const { users, total } = await userService.listUsers(filters);
  res.json({ status: 'ok', total, users });
}

/** GET /api/v1/admin/events */
async function adminListEvents(req, res) {
  const result = await eventService.listAdmin(req.validatedQuery || {});
  res.json({ status: 'ok', ...result });
}

/** POST /api/v1/admin/events */
async function adminCreateEvent(req, res) {
  const event = await eventService.createEvent(req.body);
  res.status(201).json({ status: 'ok', event });
}

/** PUT /api/v1/admin/events/:id */
async function adminUpdateEvent(req, res) {
  const event = await eventService.updateEvent(req.validatedParams.id, req.body);
  res.json({ status: 'ok', event });
}

module.exports = { listUsers, adminListEvents, adminCreateEvent, adminUpdateEvent };