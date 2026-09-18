'use strict';
// Repository layer - SQL for `shows` + show inventory reads.
// docs/03-database-design.md 3.6-3.7, docs/04-api-design.md 4.3-4.4.
// All statements use pool.execute with bound params (docs/11-security.md 11.2).
const { pool } = require('../database/pool');
const SHOW_STATUSES = ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'];
const SHOW_COLUMNS = 'id, event_id, venue_id, start_time, end_time, status, created_at';
// MySQL DATETIME rejects ISO strings with 'T'/'Z' + millis
// (ER_TRUNCATED_WRONG_VALUE), so normalize to 'YYYY-MM-DD HH:MM:SS' (UTC).
function toMysqlDatetime(value) {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
// Show with its event + venue + live seat counts (tests/sql/05 Q2/Q5).
const SHOW_DETAIL_SELECT = `s.id, s.event_id, s.venue_id, s.start_time, s.end_time, s.status, s.created_at,
  e.name AS event_name, e.status AS event_status,
  v.name AS venue_name, v.address AS venue_address, v.city AS venue_city, v.capacity AS venue_capacity,
  (SELECT COUNT(*) FROM show_seats ss WHERE ss.show_id = s.id) AS total_seats,
  (SELECT COUNT(*) FROM show_seats ss WHERE ss.show_id = s.id AND ss.status = 'AVAILABLE') AS available_seats,
  (SELECT COUNT(*) FROM show_seats ss WHERE ss.show_id = s.id AND ss.status = 'HELD') AS held_seats,
  (SELECT COUNT(*) FROM show_seats ss WHERE ss.show_id = s.id AND ss.status = 'BOOKED') AS booked_seats,
  (SELECT COUNT(*) FROM show_seats ss WHERE ss.show_id = s.id AND ss.status = 'BLOCKED') AS blocked_seats`;
async function list(filters = {}) {
  const conditions = [];
  const params = [];
  if (filters.eventId) { conditions.push('s.event_id = ?'); params.push(filters.eventId); }
  if (filters.venueId) { conditions.push('s.venue_id = ?'); params.push(filters.venueId); }
  if (filters.status) { conditions.push('s.status = ?'); params.push(filters.status); }
  if (filters.upcoming) { conditions.push(`s.status = 'SCHEDULED'`); conditions.push('s.start_time > NOW()'); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Number.isInteger(filters.limit) ? filters.limit : 20;
  const offset = Number.isInteger(filters.offset) ? filters.offset : 0;
  const [rows] = await pool.execute(
    `SELECT ${SHOW_DETAIL_SELECT} FROM shows s
      JOIN events e ON e.id = s.event_id JOIN venues v ON v.id = s.venue_id
      ${where} ORDER BY s.start_time ASC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [c] = await pool.execute(`SELECT COUNT(*) AS total FROM shows s ${where}`, params);
  return { rows, total: Number(c[0].total) };
}
async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${SHOW_COLUMNS} FROM shows WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}
async function findDetailById(id) {
  const [rows] = await pool.execute(
    `SELECT ${SHOW_DETAIL_SELECT} FROM shows s
      JOIN events e ON e.id = s.event_id JOIN venues v ON v.id = s.venue_id
     WHERE s.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}
async function create(input) {
  try {
    const [r] = await pool.execute(
      `INSERT INTO shows (event_id, venue_id, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)`,
      [input.eventId, input.venueId, toMysqlDatetime(input.startTime), toMysqlDatetime(input.endTime), input.status || 'SCHEDULED']
    );
    return r.insertId;
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      const err = new Error('A show for this event already exists at this start time');
      err.code = 'SHOW_DUPLICATE';
      throw err;
    }
    throw e;
  }
}
async function update(id, changes) {
  const map = { startTime: 'start_time', endTime: 'end_time', status: 'status' };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (changes[k] !== undefined) { sets.push(`${col} = ?`); params.push(changes[k]); }
  }
  if (!sets.length) return false;
  for (const [k] of Object.entries(map)) {
    if (k === 'startTime' || k === 'endTime') {
      const i = sets.findIndex((s) => s.startsWith(k === 'startTime' ? 'start_time' : 'end_time'));
      params[i] = toMysqlDatetime(params[i]);
    }
  }
  params.push(id);
  try {
    const [r] = await pool.execute(`UPDATE shows SET ${sets.join(', ')} WHERE id = ?`, params);
    return r.affectedRows > 0;
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      const err = new Error('A show for this event already exists at this start time');
      err.code = 'SHOW_DUPLICATE';
      throw err;
    }
    throw e;
  }
}
// Full seat map for a show (tests/sql/06 Q1).
async function seatMap(showId) {
  const [rows] = await pool.execute(
    `SELECT ss.id AS show_seat_id, ss.show_id, ss.price, ss.status, ss.hold_expires_at,
            s.id AS seat_id, s.row_number, s.seat_number, s.seat_type
       FROM show_seats ss JOIN seats s ON s.id = ss.seat_id
      WHERE ss.show_id = ?
      ORDER BY s.row_number ASC, CAST(s.seat_number AS UNSIGNED) ASC, s.seat_number ASC`,
    [showId]
  );
  return rows;
}
// Availability summary grouped by row (tests/sql/06 Q2).
async function availabilityByRow(showId) {
  const [rows] = await pool.execute(
    `SELECT s.row_number,
            COUNT(*) AS total_seats,
            COUNT(CASE WHEN ss.status = 'AVAILABLE' THEN 1 END) AS available,
            COUNT(CASE WHEN ss.status = 'HELD' THEN 1 END) AS held,
            COUNT(CASE WHEN ss.status = 'BOOKED' THEN 1 END) AS booked,
            COUNT(CASE WHEN ss.status = 'BLOCKED' THEN 1 END) AS blocked
       FROM show_seats ss JOIN seats s ON s.id = ss.seat_id
      WHERE ss.show_id = ? GROUP BY s.row_number ORDER BY s.row_number ASC`,
    [showId]
  );
  return rows;
}
async function availabilityTotals(showId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total_seats,
            COUNT(CASE WHEN status = 'AVAILABLE' THEN 1 END) AS available,
            COUNT(CASE WHEN status = 'HELD' THEN 1 END) AS held,
            COUNT(CASE WHEN status = 'BOOKED' THEN 1 END) AS booked,
            COUNT(CASE WHEN status = 'BLOCKED' THEN 1 END) AS blocked
       FROM show_seats WHERE show_id = ?`,
    [showId]
  );
  return rows[0];
}
// Build per-seat inventory from the venue layout. INSERT IGNORE makes this
// idempotent, so provisioning can safely be retried.
async function provisionInventory(showId, defaultPrice) {
  const [r] = await pool.execute(
    `INSERT IGNORE INTO show_seats (show_id, seat_id, price, status)
     SELECT ?, s.id, ?, 'AVAILABLE' FROM seats s
      JOIN shows sh ON sh.venue_id = s.venue_id WHERE sh.id = ?`,
    [showId, defaultPrice, showId]
  );
  return r.affectedRows;
}
async function countInventory(showId) {
  const [rows] = await pool.execute('SELECT COUNT(*) AS c FROM show_seats WHERE show_id = ?', [showId]);
  return Number(rows[0].c);
}
module.exports = { SHOW_STATUSES, list, findById, findDetailById, create, update, seatMap, availabilityByRow, availabilityTotals, provisionInventory, countInventory };
