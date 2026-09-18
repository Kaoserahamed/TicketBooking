'use strict';

/**
 * Service layer - user administration (docs/04-api-design.md §4.8,
 * docs/11-security.md §11.1).
 */

const userRepository = require('../repositories/user.repository');
const { toPublicUser } = require('../utils/serialize');

/**
 * List users for the admin dashboard, optionally filtered by role/status.
 *
 * @param {{role?: string, status?: string, limit?: number}} [filters]
 * @returns {Promise<{users: object[], total: number}>}
 */
async function listUsers(filters = {}) {
  const rows = await userRepository.list(filters);
  return { users: rows.map(toPublicUser), total: rows.length };
}

module.exports = { listUsers };