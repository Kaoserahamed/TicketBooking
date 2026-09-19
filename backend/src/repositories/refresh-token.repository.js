'use strict';

/**
 * Repository layer for `refresh_tokens` - the store behind refresh-token
 * rotation (docs/11-security.md §11.2).
 *
 * Rows are keyed by the SHA-256 hash of the token, so a leaked database cannot
 * be used to replay a session.
 */

const { pool } = require('../database/pool');

/**
 * Persist a newly issued refresh token.
 *
 * @param {{userId: number|string, tokenHash: string, expiresAt: Date, userAgent?: string|null, ipAddress?: string|null}} input
 * @returns {Promise<number>} new row id
 */
async function store(input) {
  const [result] = await pool.execute(
    `INSERT INTO refresh_tokens
        (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.userId,
      input.tokenHash,
      input.expiresAt,
      input.userAgent ? String(input.userAgent).slice(0, 255) : null,
      input.ipAddress ? String(input.ipAddress).slice(0, 45) : null,
    ]
  );
  return result.insertId;
}

/**
 * Look up a refresh token by its hash, joined with the owning user so the
 * caller can check the account status in the same round trip.
 *
 * @param {string} tokenHash
 * @returns {Promise<object|null>}
 */
async function findByHash(tokenHash) {
  const [rows] = await pool.execute(
    `SELECT rt.id,
            rt.user_id,
            rt.token_hash,
            rt.expires_at,
            rt.revoked_at,
            rt.replaced_by_hash,
            u.name            AS user_name,
            u.email           AS user_email,
            u.role            AS user_role,
            u.status          AS user_status
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = ?
      LIMIT 1`,
    [tokenHash]
  );
  return rows[0] ?? null;
}

/**
 * Revoke a refresh token, optionally recording the hash that replaced it
 * (rotation audit trail).
 *
 * @param {number|string} id
 * @param {string|null} [replacedByHash]
 * @returns {Promise<boolean>} true when a row was updated
 */
async function revoke(id, replacedByHash = null) {
  const [result] = await pool.execute(
    `UPDATE refresh_tokens
        SET revoked_at = UTC_TIMESTAMP(), replaced_by_hash = ?
      WHERE id = ? AND revoked_at IS NULL`,
    [replacedByHash, id]
  );
  return result.affectedRows > 0;
}

/**
 * Revoke every active refresh token for a user (used on logout-everywhere and
 * when token reuse is detected).
 *
 * @param {number|string} userId
 * @returns {Promise<number>} number of revoked rows
 */
async function revokeAllForUser(userId) {
  const [result] = await pool.execute(
    `UPDATE refresh_tokens
        SET revoked_at = UTC_TIMESTAMP()
      WHERE user_id = ? AND revoked_at IS NULL`,
    [userId]
  );
  return result.affectedRows;
}

/**
 * Delete expired rows. Called opportunistically during refresh so the table
 * does not grow without bound; a scheduled worker can also invoke it.
 *
 * @returns {Promise<number>} number of deleted rows
 */
async function deleteExpired() {
  const [result] = await pool.execute(
    'DELETE FROM refresh_tokens WHERE expires_at < UTC_TIMESTAMP()'
  );
  return result.affectedRows;
}

/**
 * Count active sessions for a user (useful for tests and admin auditing).
 *
 * @param {number|string} userId
 * @returns {Promise<number>}
 */
async function countActiveForUser(userId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS active_count
       FROM refresh_tokens
      WHERE user_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
    [userId]
  );
  return Number(rows[0].active_count);
}

module.exports = {
  store,
  findByHash,
  revoke,
  revokeAllForUser,
  deleteExpired,
  countActiveForUser,
};
