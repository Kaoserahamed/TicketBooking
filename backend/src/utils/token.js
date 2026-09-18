'use strict';

/**
 * JWT issuing/verification and refresh-token hashing.
 *
 * Token design (docs/11-security.md §11.1):
 *   access token  - short lived (15m), carries identity + role for RBAC
 *   refresh token - long lived (7d), carries a unique `jti` so it can be
 *                   revoked/rotated. Only its SHA-256 hash is persisted.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

const ACCESS_TOKEN_TYPE = 'access';
const REFRESH_TOKEN_TYPE = 'refresh';

/**
 * Sign a short-lived access token.
 *
 * @param {{id: number|string, role: string, email: string}} user
 * @returns {string} signed JWT
 */
function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      email: user.email,
      type: ACCESS_TOKEN_TYPE,
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn, issuer: config.jwt.issuer }
  );
}

/**
 * Sign a long-lived refresh token. The `jti` claim uniquely identifies this
 * token instance so it can be tracked and revoked.
 *
 * @param {{id: number|string}} user
 * @returns {string} signed JWT
 */
function signRefreshToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      jti: crypto.randomUUID(),
      type: REFRESH_TOKEN_TYPE,
    },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn, issuer: config.jwt.issuer }
  );
}

/**
 * Verify an access token.
 *
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {jwt.JsonWebTokenError|jwt.TokenExpiredError}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret, { issuer: config.jwt.issuer });
}

/**
 * Verify a refresh token.
 *
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {jwt.JsonWebTokenError|jwt.TokenExpiredError}
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret, { issuer: config.jwt.issuer });
}

/**
 * Hash a refresh token for storage/lookup. Raw tokens are never persisted.
 *
 * @param {string} token
 * @returns {string} 64-character SHA-256 hex digest
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a cryptographically random, URL-safe opaque token.
 *
 * Used for email-verification and password-reset links. 32 random bytes give
 * ~256 bits of entropy, so the value cannot be guessed.
 *
 * @returns {string} base64url token (no padding)
 */
function generateOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Read the expiry of a signed token without verifying it (used to store the
 * refresh-token expiry in the database).
 *
 * @param {string} token
 * @returns {Date} expiry date
 */
function getTokenExpiry(token) {
  const decoded = jwt.decode(token);
  if (!decoded || !decoded.exp) {
    throw new Error('Token has no expiry claim');
  }
  return new Date(decoded.exp * 1000);
}

module.exports = {
  ACCESS_TOKEN_TYPE,
  REFRESH_TOKEN_TYPE,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  getTokenExpiry,
  generateOpaqueToken,
};
