'use strict';
// Service layer - shows/schedules + seat inventory reads (no HTTP, no SQL).
// docs/02-system-architecture.md 2.4 "schedules (showtime configuration)" +
// "inventory (seat availability & hold logic)" (reads only - holds are bookings).
// docs/04-api-design.md 4.3-4.4.
const showRepository = require('../repositories/show.repository');
const eventRepository = require('../repositories/event.repository');
const venueRepository = require('../repositories/venue.repository');
const { toShowDetail, toShowSeat, toAvailability } = require('../utils/serialize');
const { ConflictError, NotFoundError, ValidationError } = require('../utils/errors');
async function listShows(filters = {}) {
  const { rows, total } = await showRepository.list(filters);
  return { shows: rows.map(toShowDetail), total, ...pagingOf(filters) };
}
async function getShow(id) {
  const row = await showRepository.findDetailById(id);
  if (!row) throw new NotFoundError('Show not found', 'SHOW_NOT_FOUND');
  return toShowDetail(row);
}
async function createShow(input) {
  const event = await eventRepository.findById(input.eventId);
  if (!event) throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
  const venue = await venueRepository.findById(input.venueId);
  if (!venue) throw new NotFoundError('Venue not found', 'VENUE_NOT_FOUND');
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  if (!(start < end)) {
    throw new ValidationError('endTime must be after startTime', [{ field: 'endTime', message: 'endTime must be after startTime' }]);
  }
  let id;
  try {
    id = await showRepository.create({
      eventId: input.eventId, venueId: input.venueId,
      startTime: input.startTime, endTime: input.endTime, status: input.status || 'SCHEDULED',
    });
  } catch (e) {
    if (e.code === 'SHOW_DUPLICATE') throw new ConflictError(e.message, 'SHOW_ALREADY_EXISTS');
    throw e;
  }
  if (input.provisionInventory !== false) {
    await showRepository.provisionInventory(id, input.defaultPrice ?? 100.0);
  }
  return toShowDetail(await showRepository.findDetailById(id));
}
async function updateShow(id, changes) {
  const existing = await showRepository.findById(id);
  if (!existing) throw new NotFoundError('Show not found', 'SHOW_NOT_FOUND');
  const start = changes.startTime !== undefined ? new Date(changes.startTime) : new Date(existing.start_time);
  const end = changes.endTime !== undefined ? new Date(changes.endTime) : new Date(existing.end_time);
  if (!(start < end)) {
    throw new ValidationError('endTime must be after startTime', [{ field: 'endTime', message: 'endTime must be after startTime' }]);
  }
  if (Object.keys(changes).length) {
    try {
      await showRepository.update(id, changes);
    } catch (e) {
      if (e.code === 'SHOW_DUPLICATE') throw new ConflictError(e.message, 'SHOW_ALREADY_EXISTS');
      throw e;
    }
  }
  return toShowDetail(await showRepository.findDetailById(id));
}
async function seatMap(showId) {
  await requireShow(showId);
  const rows = await showRepository.seatMap(showId);
  return { showId: Number(showId), total: rows.length, seats: rows.map(toShowSeat) };
}
async function availability(showId) {
  await requireShow(showId);
  const [totals, byRow] = await Promise.all([
    showRepository.availabilityTotals(showId),
    showRepository.availabilityByRow(showId),
  ]);
  return toAvailability(showId, totals, byRow);
}
async function requireShow(id) {
  const row = await showRepository.findById(id);
  if (!row) throw new NotFoundError('Show not found', 'SHOW_NOT_FOUND');
  return row;
}
function pagingOf(f = {}) {
  return { limit: Number.isInteger(f.limit) ? f.limit : 20, offset: Number.isInteger(f.offset) ? f.offset : 0 };
}
module.exports = { listShows, getShow, createShow, updateShow, seatMap, availability };
