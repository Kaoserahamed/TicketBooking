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
const AUTH_COLUMNS =
  'id, name, email, phone, password_hash, role, status, email_verified_at, created_at, updated_at';
// Columns returned for read-only/profile use.
const PUBLIC_COLUMNS =
  'id, name, email, phone, role, status, email_verified_at, created_at, updated_at';

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

/**
 * Find a user by primary key, including `password_hash`.
 *
 * Used where a password must be verified (e.g. change-password). Never
 * serialize the result directly - pass it through `toPublicUser`.
 *
 * @param {number|string} id
 * @returns {Promise<object|null>}
 */
async function findAuthById(id) {
  const [rows] = await pool.execute(
    `SELECT ${AUTH_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Update the mutable profile fields of a user.
 *
 * Only the provided keys are written, so a partial update never clears a field.
 *
 * @param {number|string} id
 * @param {{name?: string, email?: string, phone?: string|null}} changes
 * @returns {Promise<boolean>} true when a row was updated
 */
async function updateProfile(id, changes) {
  const assignments = [];
  const params = [];

  if (changes.name !== undefined) {
    assignments.push('name = ?');
    params.push(changes.name);
  }
  if (changes.email !== undefined) {
    assignments.push('email = ?');
    params.push(changes.email);
  }
  if (changes.phone !== undefined) {
    assignments.push('phone = ?');
    params.push(changes.phone);
  }

  if (assignments.length === 0) {
    return false;
  }

  params.push(id);
  const [result] = await pool.execute(
    `UPDATE users SET ${assignments.join(', ')} WHERE id = ?`,
    params
  );
  return result.affectedRows > 0;
}

/**
 * Replace a user's password hash.
 *
 * @param {number|string} id
 * @param {string} passwordHash
 * @returns {Promise<boolean>}
 */
async function updatePassword(id, passwordHash) {
  const [result] = await pool.execute(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [passwordHash, id]
  );
  return result.affectedRows > 0;
}

/**
 * Mark a user's email address as verified (idempotent).
 *
 * @param {number|string} id
 * @returns {Promise<boolean>}
 */
async function markEmailVerified(id) {
  const [result] = await pool.execute(
    `UPDATE users
        SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP())
      WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}

/**
 * Clear a user's email verification (used when the address changes, since the
 * new address has not been proven).
 *
 * @param {number|string} id
 * @returns {Promise<boolean>}
 */
async function clearEmailVerified(id) {
  const [result] = await pool.execute(
    'UPDATE users SET email_verified_at = NULL WHERE id = ?',
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = {
  findByEmail,
  findById,
  findAuthById,
  findByPhone,
  create,
  list,
  updateProfile,
  updatePassword,
  markEmailVerified,
  clearEmailVerified,
};