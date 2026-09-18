'use strict';
// Repository layer - SQL for `venues` + venue->seats reads.
// docs/03-database-design.md 3.3-3.4, docs/02-system-architecture.md 2.4
// "venues (venue configuration)" + "seats (seat layout / seat config)".
// All statements use pool.execute with bound params (docs/11-security.md 11.2).
const { pool } = require('../database/pool');
const VENUE_COLUMNS = 'id, name, address, city, capacity, created_at';
const SEAT_COLUMNS = 'id, venue_id, `row_number`, seat_number, seat_type, created_at';
const SEAT_TYPES = ['REGULAR', 'VIP', 'PREMIUM', 'BALCONY', 'BOX'];
async function list(filters = {}) {
  const conditions = [];
  const params = [];
  if (filters.city) { conditions.push('city = ?'); params.push(filters.city); }
  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push('(name LIKE ? OR city LIKE ?)');
    params.push(like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Number.isInteger(filters.limit) ? filters.limit : 20;
  const offset = Number.isInteger(filters.offset) ? filters.offset : 0;
  const [rows] = await pool.execute(
    `SELECT ${VENUE_COLUMNS} FROM venues ${where} ORDER BY city ASC, name ASC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [c] = await pool.execute(`SELECT COUNT(*) AS total FROM venues ${where}`, params);
  return { rows, total: Number(c[0].total) };
}
async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${VENUE_COLUMNS} FROM venues WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}
// Venue with seat-layout summary (tests/sql/04-venue-seat-queries.sql Q2).
async function findWithSeatSummary(id) {
  const [rows] = await pool.execute(
    `SELECT v.id, v.name, v.address, v.city, v.capacity, v.created_at,
            COUNT(s.id) AS total_seats,
            COUNT(CASE WHEN s.seat_type = 'VIP' THEN 1 END) AS vip_seats,
            COUNT(CASE WHEN s.seat_type = 'PREMIUM' THEN 1 END) AS premium_seats,
            COUNT(CASE WHEN s.seat_type = 'REGULAR' THEN 1 END) AS regular_seats,
            COUNT(CASE WHEN s.seat_type = 'BALCONY' THEN 1 END) AS balcony_seats,
            COUNT(CASE WHEN s.seat_type = 'BOX' THEN 1 END) AS box_seats
       FROM venues v LEFT JOIN seats s ON s.venue_id = v.id
      WHERE v.id = ? GROUP BY v.id, v.name, v.address, v.city, v.capacity, v.created_at LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}
async function create(input) {
  const [r] = await pool.execute(
    `INSERT INTO venues (name, address, city, capacity) VALUES (?, ?, ?, ?)`,
    [input.name, input.address ?? null, input.city, input.capacity]
  );
  return r.insertId;
}
async function update(id, changes) {
  const map = { name: 'name', address: 'address', city: 'city', capacity: 'capacity' };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (changes[k] !== undefined) { sets.push(`${col} = ?`); params.push(changes[k]); }
  }
  if (!sets.length) return false;
  params.push(id);
  const [r] = await pool.execute(`UPDATE venues SET ${sets.join(', ')} WHERE id = ?`, params);
  return r.affectedRows > 0;
}
// Seats of a venue, ordered for seat-map display (tests/sql/04 Q3).
async function listSeats(venueId, filters = {}) {
  const conditions = ['venue_id = ?'];
  const params = [venueId];
  if (filters.seatType) { conditions.push('seat_type = ?'); params.push(filters.seatType); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const limit = Number.isInteger(filters.limit) ? filters.limit : 500;
  const offset = Number.isInteger(filters.offset) ? filters.offset : 0;
  const [rows] = await pool.execute(
    `SELECT ${SEAT_COLUMNS} FROM seats ${where} ORDER BY \`row_number\` ASC, CAST(seat_number AS UNSIGNED) ASC, seat_number ASC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [c] = await pool.execute(`SELECT COUNT(*) AS total FROM seats ${where}`, params);
  return { rows, total: Number(c[0].total) };
}
async function createSeat(input) {
  try {
    const [r] = await pool.execute(
      `INSERT INTO seats (venue_id, \`row_number\`, seat_number, seat_type) VALUES (?, ?, ?, ?)`,
      [input.venueId, input.rowNumber, input.seatNumber, input.seatType || 'REGULAR']
    );
    return r.insertId;
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      const err = new Error('A seat with this row and number already exists in this venue');
      err.code = 'SEAT_DUPLICATE';
      throw err;
    }
    throw e;
  }
}
async function updateSeat(id, changes) {
  const map = { seatType: 'seat_type' };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (changes[k] !== undefined) { sets.push(`${col} = ?`); params.push(changes[k]); }
  }
  if (!sets.length) return false;
  params.push(id);
  const [r] = await pool.execute(`UPDATE seats SET ${sets.join(', ')} WHERE id = ?`, params);
  return r.affectedRows > 0;
}
async function findSeatById(id) {
  const [rows] = await pool.execute(`SELECT ${SEAT_COLUMNS} FROM seats WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}
async function deleteSeat(id) {
  const [r] = await pool.execute('DELETE FROM seats WHERE id = ?', [id]);
  return r.affectedRows > 0;
}
module.exports = { SEAT_TYPES, list, findById, findWithSeatSummary, create, update, listSeats, createSeat, updateSeat, findSeatById, deleteSeat };
