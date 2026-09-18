'use strict';

/**
 * Password hashing (docs/11-security.md §11.2 - "Secure password hashing
 * (bcrypt / argon2)").
 *
 * bcryptjs is used instead of the native `bcrypt` binding so the API installs
 * and runs without a C toolchain on every platform.
 */

const bcrypt = require('bcryptjs');
const config = require('../config/env');

/**
 * Hash a plaintext password.
 *
 * @param {string} plainPassword
 * @returns {Promise<string>} bcrypt hash (60 characters, includes the salt)
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, config.security.bcryptRounds);
}

/**
 * Compare a plaintext password with a stored hash.
 *
 * @param {string} plainPassword
 * @param {string} passwordHash
 * @returns {Promise<boolean>} true when the password matches
 */
async function verifyPassword(plainPassword, passwordHash) {
  if (typeof plainPassword !== 'string' || typeof passwordHash !== 'string') {
    return false;
  }

  try {
    return await bcrypt.compare(plainPassword, passwordHash);
  } catch (error) {
    // A malformed/placeholder hash (e.g. legacy seed data) must read as
    // "wrong password" rather than surfacing a 500 to the client.
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
