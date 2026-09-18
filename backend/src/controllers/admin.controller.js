'use strict';

/**
 * Controller layer - admin endpoints (docs/04-api-design.md §4.8).
 */

const userService = require('../services/user.service');

/** GET /api/v1/admin/users */
async function listUsers(req, res) {
  const filters = req.validatedQuery || {};
  const { users, total } = await userService.listUsers(filters);
  res.json({ status: 'ok', total, users });
}

module.exports = { listUsers };