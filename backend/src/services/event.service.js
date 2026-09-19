'use strict';
// Service layer - events business rules (no HTTP, no SQL).
// docs/02-system-architecture.md 2.4 "events (event CRUD)",
// docs/04-api-design.md 4.3 + 4.8.
const eventRepository = require('../repositories/event.repository');
const { toEvent, toShow } = require('../utils/serialize');
const { NotFoundError } = require('../utils/errors');
async function listPublic(filters = {}) {
  const { rows, total } = await eventRepository.listPublic(filters);
  return { events: rows.map(toEvent), total, ...pagingOf(filters) };
}
async function getPublicById(id) {
  const row = await eventRepository.findPublicById(id);
  if (!row) throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
  return toEvent(row);
}
async function listShowsForEvent(eventId, paging = {}) {
  await getPublicById(eventId);
  const { rows, total } = await eventRepository.listShowsForEvent(eventId, paging);
  return { eventId: Number(eventId), shows: rows.map(toShow), total, ...pagingOf(paging) };
}
async function listAdmin(filters = {}) {
  const { rows, total } = await eventRepository.listAdmin(filters);
  return { events: rows.map(toEvent), total, ...pagingOf(filters) };
}
async function createEvent(input) {
  const id = await eventRepository.create({
    name: String(input.name).trim(),
    description: input.description === undefined ? null : String(input.description).trim() || null,
    category: input.category === undefined ? null : String(input.category).trim() || null,
    posterUrl: input.posterUrl ?? null,
    status: input.status || 'DRAFT',
  });
  return toEvent(await eventRepository.findById(id));
}
async function updateEvent(id, changes) {
  const existing = await eventRepository.findById(id);
  if (!existing) throw new NotFoundError('Event not found', 'EVENT_NOT_FOUND');
  const norm = {};
  if (changes.name !== undefined) norm.name = String(changes.name).trim();
  if (changes.description !== undefined) {
    norm.description =
      changes.description === null ? null : String(changes.description).trim() || null;
  }
  if (changes.category !== undefined) {
    norm.category = changes.category === null ? null : String(changes.category).trim() || null;
  }
  if (changes.posterUrl !== undefined) norm.posterUrl = changes.posterUrl;
  if (changes.status !== undefined) norm.status = changes.status;
  if (Object.keys(norm).length) await eventRepository.update(id, norm);
  return toEvent(await eventRepository.findById(id));
}
function pagingOf(f = {}) {
  return {
    limit: Number.isInteger(f.limit) ? f.limit : 20,
    offset: Number.isInteger(f.offset) ? f.offset : 0,
  };
}
module.exports = {
  listPublic,
  getPublicById,
  listShowsForEvent,
  listAdmin,
  createEvent,
  updateEvent,
};
