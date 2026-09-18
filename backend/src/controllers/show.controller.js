'use strict';
// Controller layer - shows/schedules + inventory reads (HTTP translation only).
const showService = require('../services/show.service');
async function listShows(req, res) {
  const result = await showService.listShows(req.validatedQuery || {});
  res.json({ status: 'ok', ...result });
}
async function getShow(req, res) {
  const show = await showService.getShow(req.validatedParams.id);
  res.json({ status: 'ok', show });
}
async function seatMap(req, res) {
  const result = await showService.seatMap(req.validatedParams.id);
  res.json({ status: 'ok', ...result });
}
async function availability(req, res) {
  const availability = await showService.availability(req.validatedParams.id);
  res.json({ status: 'ok', availability });
}
async function adminCreateShow(req, res) {
  const show = await showService.createShow(req.body);
  res.status(201).json({ status: 'ok', show });
}
async function adminUpdateShow(req, res) {
  const show = await showService.updateShow(req.validatedParams.id, req.body);
  res.json({ status: 'ok', show });
}
module.exports = { listShows, getShow, seatMap, availability, adminCreateShow, adminUpdateShow };
