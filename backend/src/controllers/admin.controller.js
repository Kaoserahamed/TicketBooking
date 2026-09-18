'use strict';

/**
 * Controller layer - admin endpoints (docs/04-api-design.md §4.8).
 */

const userService = require('../services/user.service');
const eventService = require('../services/event.service');
const venueService = require('../services/venue.service');
const showService = require('../services/show.service');

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

/** POST /api/v1/admin/venues */
async function adminCreateVenue(req, res) {
  const venue = await venueService.createVenue(req.body);
  res.status(201).json({ status: 'ok', venue });
}

/** PUT /api/v1/admin/venues/:id */
async function adminUpdateVenue(req, res) {
  const venue = await venueService.updateVenue(req.validatedParams.id, req.body);
  res.json({ status: 'ok', venue });
}

/** POST /api/v1/admin/venues/:id/seats */
async function adminCreateSeat(req, res) {
  const seat = await venueService.createSeat(req.validatedParams.id, req.body);
  res.status(201).json({ status: 'ok', seat });
}

/** PUT /api/v1/admin/venues/:id/seats/:seatId */
async function adminUpdateSeat(req, res) {
  const seat = await venueService.updateSeat(req.validatedParams.id, req.validatedParams.seatId, req.body);
  res.json({ status: 'ok', seat });
}

/** DELETE /api/v1/admin/venues/:id/seats/:seatId */
async function adminDeleteSeat(req, res) {
  await venueService.deleteSeat(req.validatedParams.id, req.validatedParams.seatId);
  res.json({ status: 'ok', message: 'Seat deleted' });
}

/** POST /api/v1/admin/shows */
async function adminCreateShow(req, res) {
  const show = await showService.createShow(req.body);
  res.status(201).json({ status: 'ok', show });
}

/** PUT /api/v1/admin/shows/:id */
async function adminUpdateShow(req, res) {
  const show = await showService.updateShow(req.validatedParams.id, req.body);
  res.json({ status: 'ok', show });
}

module.exports = {
  listUsers,
  adminListEvents,
  adminCreateEvent,
  adminUpdateEvent,
  adminCreateVenue,
  adminUpdateVenue,
  adminCreateSeat,
  adminUpdateSeat,
  adminDeleteSeat,
  adminCreateShow,
  adminUpdateShow,
};