'use strict';
// Service layer - venues + seat layout (no HTTP, no SQL).
// docs/02-system-architecture.md 2.4 "venues (venue configuration)" +
// "seats (seat layout / seat config)".
const venueRepository = require('../repositories/venue.repository');
const { toVenue, toSeat } = require('../utils/serialize');
const { ConflictError, NotFoundError } = require('../utils/errors');
async function listVenues(filters = {}) {
  const { rows, total } = await venueRepository.list(filters);
  return { venues: rows.map(toVenue), total, ...pagingOf(filters) };
}
async function getVenue(id) {
  const row = await venueRepository.findWithSeatSummary(id);
  if (!row) throw new NotFoundError('Venue not found', 'VENUE_NOT_FOUND');
  return toVenue(row);
}
async function createVenue(input) {
  const id = await venueRepository.create({
    name: String(input.name).trim(),
    address: input.address === undefined ? null : String(input.address).trim() || null,
    city: String(input.city).trim(),
    capacity: input.capacity,
  });
  return toVenue(await venueRepository.findWithSeatSummary(id));
}
async function updateVenue(id, changes) {
  const existing = await venueRepository.findById(id);
  if (!existing) throw new NotFoundError('Venue not found', 'VENUE_NOT_FOUND');
  const norm = {};
  if (changes.name !== undefined) norm.name = String(changes.name).trim();
  if (changes.address !== undefined) {
    norm.address = changes.address === null ? null : String(changes.address).trim() || null;
  }
  if (changes.city !== undefined) norm.city = String(changes.city).trim();
  if (changes.capacity !== undefined) norm.capacity = changes.capacity;
  if (Object.keys(norm).length) await venueRepository.update(id, norm);
  return toVenue(await venueRepository.findWithSeatSummary(id));
}
async function listSeats(venueId, filters = {}) {
  await requireVenue(venueId);
  const { rows, total } = await venueRepository.listSeats(venueId, filters);
  return { venueId: Number(venueId), seats: rows.map(toSeat), total, ...pagingOf(filters, 500) };
}
async function createSeat(venueId, input) {
  await requireVenue(venueId);
  try {
    const id = await venueRepository.createSeat({
      venueId, rowNumber: String(input.rowNumber).trim(), seatNumber: String(input.seatNumber).trim(), seatType: input.seatType || 'REGULAR',
    });
    return toSeat(await venueRepository.findSeatById(id));
  } catch (e) {
    if (e.code === 'SEAT_DUPLICATE') throw new ConflictError(e.message, 'SEAT_ALREADY_EXISTS');
    throw e;
  }
}
async function updateSeat(venueId, seatId, changes) {
  await requireVenue(venueId);
  const seat = await venueRepository.findSeatById(seatId);
  if (!seat || Number(seat.venue_id) !== Number(venueId)) {
    throw new NotFoundError('Seat not found in this venue', 'SEAT_NOT_FOUND');
  }
  if (changes.seatType !== undefined) await venueRepository.updateSeat(seatId, { seatType: changes.seatType });
  return toSeat(await venueRepository.findSeatById(seatId));
}
async function deleteSeat(venueId, seatId) {
  await requireVenue(venueId);
  const seat = await venueRepository.findSeatById(seatId);
  if (!seat || Number(seat.venue_id) !== Number(venueId)) {
    throw new NotFoundError('Seat not found in this venue', 'SEAT_NOT_FOUND');
  }
  await venueRepository.deleteSeat(seatId);
}
async function requireVenue(id) {
  const row = await venueRepository.findById(id);
  if (!row) throw new NotFoundError('Venue not found', 'VENUE_NOT_FOUND');
  return row;
}
function pagingOf(f = {}, dflt = 20) {
  return { limit: Number.isInteger(f.limit) ? f.limit : dflt, offset: Number.isInteger(f.offset) ? f.offset : 0 };
}
module.exports = { listVenues, getVenue, createVenue, updateVenue, listSeats, createSeat, updateSeat, deleteSeat };
