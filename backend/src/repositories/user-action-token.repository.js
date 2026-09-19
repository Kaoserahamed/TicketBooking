'use strict';

/**
 * Repository layer for `user_action_tokens` - single-use tokens backing email
 * verification and password reset.
 *
 * As with refresh tokens, only the SHA-256 hash is persisted.
 */

const { pool } = require('../database/pool');

const PURPOSES = { EMAIL_VERIFICATION: 'EMAIL_VERIFICATION', PASSWORD_RESET: 'PASSWORD_RESET' };

/**
 * Store a new action token.
 *
 * @param {{userId: number|string, purpose: string, tokenHash: string, expiresAt: Date}} input
 * @returns {Promise<number>} new row id
 */
async function create(input) {
  const [result] = await pool.execute(
    `INSERT INTO user_action_tokens (user_id, purpose, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [input.userId, input.purpose, input.tokenHash, input.expiresAt]
  );
  return result.insertId;
}

/**
 * Find a token by hash.
 *
 * @param {string} tokenHash
 * @returns {Promise<object|null>}
 */
async function findByHash(tokenHash) {
  const [rows] = await pool.execute(
    `SELECT t.id, t.user_id, t.purpose, t.expires_at, t.used_at,
            u.name AS user_name, u.email AS user_email, u.status AS user_status
       FROM user_action_tokens t
       JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ?
      LIMIT 1`,
    [tokenHash]
  );
  return rows[0] ?? null;
}

/**
 * Mark a token as used, but only if it has not been used yet. This is the
 * atomic guard that stops a token being redeemed twice under concurrency.
 *
 * @param {number|string} id
 * @returns {Promise<boolean>} true when this call consumed the token
 */
async function markUsed(id) {
  const [result] = await pool.execute(
    'UPDATE user_action_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL',
    [id]
  );
  return result.affectedRows > 0;
}

/**
 * Invalidate outstanding tokens for a user/purpose so that only the most
 * recently issued link works (re-requesting a reset invalidates the old one).
 *
 * @param {number|string} userId
 * @param {string} purpose
 * @returns {Promise<number>} number of invalidated rows
 */
async function invalidateActiveForUser(userId, purpose) {
  const [result] = await pool.execute(
    `UPDATE user_action_tokens
        SET used_at = UTC_TIMESTAMP()
      WHERE user_id = ? AND purpose = ? AND used_at IS NULL`,
    [userId, purpose]
  );
  return result.affectedRows;
}

/**
 * Delete expired tokens, keeping the table small.
 *
 * @returns {Promise<number>} number of deleted rows
 */
async function deleteExpired() {
  const [result] = await pool.execute(
    'DELETE FROM user_action_tokens WHERE expires_at < UTC_TIMESTAMP()'
  );
  return result.affectedRows;
}

module.exports = {
  PURPOSES,
  create,
  findByHash,
  markUsed,
  invalidateActiveForUser,
  deleteExpired,
};
