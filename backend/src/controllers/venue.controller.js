'use strict';
// Controller layer - venues + seat layout (HTTP translation only).
const venueService = require('../services/venue.service');
async function listVenues(req, res) {
  const result = await venueService.listVenues(req.validatedQuery || {});
  res.json({ status: 'ok', ...result });
}
async function getVenue(req, res) {
  const venue = await venueService.getVenue(req.validatedParams.id);
  res.json({ status: 'ok', venue });
}
async function listSeats(req, res) {
  const result = await venueService.listSeats(req.validatedParams.id, req.validatedQuery || {});
  res.json({ status: 'ok', ...result });
}
async function adminCreateVenue(req, res) {
  const venue = await venueService.createVenue(req.body);
  res.status(201).json({ status: 'ok', venue });
}
async function adminUpdateVenue(req, res) {
  const venue = await venueService.updateVenue(req.validatedParams.id, req.body);
  res.json({ status: 'ok', venue });
}
async function adminCreateSeat(req, res) {
  const seat = await venueService.createSeat(req.validatedParams.id, req.body);
  res.status(201).json({ status: 'ok', seat });
}
async function adminUpdateSeat(req, res) {
  const seat = await venueService.updateSeat(
    req.validatedParams.id,
    req.validatedParams.seatId,
    req.body
  );
  res.json({ status: 'ok', seat });
}
async function adminDeleteSeat(req, res) {
  await venueService.deleteSeat(req.validatedParams.id, req.validatedParams.seatId);
  res.json({ status: 'ok', message: 'Seat deleted' });
}
module.exports = {
  listVenues,
  getVenue,
  listSeats,
  adminCreateVenue,
  adminUpdateVenue,
  adminCreateSeat,
  adminUpdateSeat,
  adminDeleteSeat,
};
