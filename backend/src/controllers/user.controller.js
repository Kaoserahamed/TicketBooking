'use strict';

/**
 * Controller layer - users module (docs/02-system-architecture.md §2.4).
 */

const userService = require('../services/user.service');

/** GET /api/v1/users/me */
async function me(req, res) {
  const user = await userService.getProfile(req.user.id);
  res.json({ status: 'ok', user });
}

/** GET /api/v1/users/:id (self, or any user for an ADMIN) */
async function getById(req, res) {
  const user = await userService.getProfileForRequester(req.params.id, req.user);
  res.json({ status: 'ok', user });
}

/** PUT /api/v1/users/me */
async function updateMe(req, res) {
  const user = await userService.updateProfile(req.user.id, req.body);
  res.json({ status: 'ok', user });
}

/** PUT /api/v1/users/me/password */
async function changePassword(req, res) {
  await userService.changePassword(req.user.id, req.body);
  res.json({
    status: 'ok',
    message: 'Password updated. All sessions were signed out - please sign in again.',
  });
}

module.exports = { me, getById, updateMe, changePassword };