'use strict';
// Repository layer - SQL for `events` + event->shows reads.
// docs/03-database-design.md 3.5-3.6, docs/04-api-design.md 4.3.
// All statements use pool.execute with bound params (docs/11-security.md 11.2).
const { pool } = require('../database/pool');
const EVENT_COLUMNS = 'id, name, description, category, poster_url, status, created_at, updated_at';
const PUBLIC_STATUSES = ['PUBLISHED', 'ACTIVE'];
function buildPublicFilter(filters = {}) {
  const conditions = [];
  const params = [];
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  } else {
    conditions.push('status IN (?, ?)');
    params.push(...PUBLIC_STATUSES);
  }
  if (filters.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }
  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push('(name LIKE ? OR description LIKE ?)');
    params.push(like, like);
  }
  return { where: `WHERE ${conditions.join(' AND ')}`, params };
}
async function listPublic(filters = {}) {
  const { where, params } = buildPublicFilter(filters);
  const limit = Number.isInteger(filters.limit) ? filters.limit : 20;
  const offset = Number.isInteger(filters.offset) ? filters.offset : 0;
  const [rows] = await pool.execute(
    `SELECT ${EVENT_COLUMNS} FROM events ${where} ORDER BY created_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [c] = await pool.execute(`SELECT COUNT(*) AS total FROM events ${where}`, params);
  return { rows, total: Number(c[0].total) };
}
async function findPublicById(id) {
  const [rows] = await pool.execute(
    `SELECT ${EVENT_COLUMNS} FROM events WHERE id = ? AND status IN (?, ?) LIMIT 1`,
    [id, ...PUBLIC_STATUSES]
  );
  return rows[0] ?? null;
}
async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${EVENT_COLUMNS} FROM events WHERE id = ? LIMIT 1`, [
    id,
  ]);
  return rows[0] ?? null;
}
async function listShowsForEvent(eventId, paging = {}) {
  const limit = Number.isInteger(paging.limit) ? paging.limit : 50;
  const offset = Number.isInteger(paging.offset) ? paging.offset : 0;
  const [rows] = await pool.execute(
    `SELECT s.id, s.event_id, s.venue_id, s.start_time, s.end_time, s.status, s.created_at,
            v.name AS venue_name, v.address AS venue_address,
            v.city AS venue_city, v.capacity AS venue_capacity
       FROM shows s JOIN venues v ON v.id = s.venue_id
      WHERE s.event_id = ? ORDER BY s.start_time ASC LIMIT ${limit} OFFSET ${offset}`,
    [eventId]
  );
  const [c] = await pool.execute('SELECT COUNT(*) AS total FROM shows WHERE event_id = ?', [
    eventId,
  ]);
  return { rows, total: Number(c[0].total) };
}
async function listAdmin(filters = {}) {
  const conditions = [];
  const params = [];
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }
  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push('(name LIKE ? OR description LIKE ?)');
    params.push(like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Number.isInteger(filters.limit) ? filters.limit : 20;
  const offset = Number.isInteger(filters.offset) ? filters.offset : 0;
  const [rows] = await pool.execute(
    `SELECT ${EVENT_COLUMNS} FROM events ${where} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [c] = await pool.execute(`SELECT COUNT(*) AS total FROM events ${where}`, params);
  return { rows, total: Number(c[0].total) };
}
async function create(input) {
  const [r] = await pool.execute(
    `INSERT INTO events (name, description, category, poster_url, status) VALUES (?, ?, ?, ?, ?)`,
    [
      input.name,
      input.description ?? null,
      input.category ?? null,
      input.posterUrl ?? null,
      input.status || 'DRAFT',
    ]
  );
  return r.insertId;
}
async function update(id, changes) {
  const map = {
    name: 'name',
    description: 'description',
    category: 'category',
    posterUrl: 'poster_url',
    status: 'status',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (changes[k] !== undefined) {
      sets.push(`${col} = ?`);
      params.push(changes[k]);
    }
  }
  if (!sets.length) return false;
  params.push(id);
  const [r] = await pool.execute(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, params);
  return r.affectedRows > 0;
}
module.exports = {
  PUBLIC_STATUSES,
  listPublic,
  findPublicById,
  findById,
  listShowsForEvent,
  listAdmin,
  create,
  update,
};
