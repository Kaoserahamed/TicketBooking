'use strict';

/**
 * Response serializers.
 *
 * Keeping these in one place guarantees that internal columns (above all
 * `password_hash`) can never leak through an API response.
 */

/**
 * Shape a `users` row for API responses.
 *
 * @param {object} row raw database row
 * @returns {object} public user object
 */
function toPublicUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { toPublicUser };
