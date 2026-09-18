'use strict';

/**
 * Repository layer - the only place that talks SQL for the `users` table.
 *
 * Every statement uses `pool.execute` (mysql2 prepared statements) with bound
 * parameters, which is the SQL-injection protection required by
 * docs/11-security.md §11.2. Services never build SQL themselves.
 */

const { pool } = require('../database/pool');

// Columns returned for authentication (includes the hash - never serialized to a client).
const AUTH_COLUMNS = 'id, name, email, phone, password_hash, role, status, created_at, updated_at';
// Columns returned for read-only/profile use.
const PUBLIC_COLUMNS = 'id, name, email, phone, role, status, created_at, updated_at';

/**
 * Find a user by email (case-insensitive at the collation level).
 *
 * @param {string} email
 * @returns {Promise<object|null>} row including `password_hash`
 */
async function findByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT ${AUTH_COLUMNS} FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows[0] ?? null;
}

/**
 * Find a user by primary key.
 *
 * @param {number|string} id
 * @returns {Promise<object|null>} row without `password_hash`
 */
async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Find a user by phone number.
 *
 * @param {string} phone
 * @returns {Promise<object|null>}
 */
async function findByPhone(phone) {
  const [rows] = await pool.execute(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE phone = ? LIMIT 1`,
    [phone]
  );
  return rows[0] ?? null;
}

/**
 * Insert a new user.
 *
 * @param {{name: string, email: string, phone: string|null, passwordHash: string, role?: string}} input
 * @returns {Promise<number>} new user id
 */
async function create(input) {
  const [result] = await pool.execute(
    `INSERT INTO users (name, email, phone, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
    [input.name, input.email, input.phone, input.passwordHash, input.role || 'USER']
  );
  return result.insertId;
}

/**
 * List users with optional filters (admin: docs/04-api-design.md §4.8).
 *
 * Filters are appended as bound parameters, so the query text never contains
 * user-supplied values.
 *
 * @param {{role?: string, status?: string, limit?: number}} [filters]
 * @returns {Promise<object[]>}
 */
async function list(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.role) {
    conditions.push('role = ?');
    params.push(filters.role);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  // LIMIT must be an inlined integer - MySQL does not accept it as a placeholder.
  const limit = Number.isInteger(filters.limit) ? filters.limit : 50;

  const [rows] = await pool.execute(
    `SELECT ${PUBLIC_COLUMNS} FROM users ${where} ORDER BY id ASC LIMIT ${limit}`,
    params
  );
  return rows;
}

module.exports = {
  findByEmail,
  findById,
  findByPhone,
  create,
  list,
};