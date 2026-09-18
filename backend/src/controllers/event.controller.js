'use strict';
// Controller layer - events (HTTP translation only).
const eventService = require('../services/event.service');
async function listEvents(req, res) {
  const q = req.validatedQuery || {};
  const result = await eventService.listPublic(q);
  res.json({ status: 'ok', ...result });
}
async function getEvent(req, res) {
  const event = await eventService.getPublicById(req.validatedParams.id);
  res.json({ status: 'ok', event });
}
async function listShows(req, res) {
  const q = req.validatedQuery || {};
  const result = await eventService.listShowsForEvent(req.validatedParams.id, q);
  res.json({ status: 'ok', ...result });
}
async function adminList(req, res) {
  const result = await eventService.listAdmin(req.validatedQuery || {});
  res.json({ status: 'ok', ...result });
}
async function adminCreate(req, res) {
  const event = await eventService.createEvent(req.body);
  res.status(201).json({ status: 'ok', event });
}
async function adminUpdate(req, res) {
  const event = await eventService.updateEvent(req.validatedParams.id, req.body);
  res.json({ status: 'ok', event });
}
module.exports = { listEvents, getEvent, listShows, adminList, adminCreate, adminUpdate };
