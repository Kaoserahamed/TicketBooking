'use strict';

/**
 * Route layer - users module (docs/02-system-architecture.md §2.4).
 *
 * Every route requires a valid access token; `/me` always acts on the
 * authenticated user, so a client can never address another account by id.
 */

const express = require('express');
const userController = require('../controllers/user.controller');
const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const { authRateLimiter } = require('../middlewares/rate-limit');
const { updateProfileSchema, changePasswordSchema } = require('../validators/user.validator');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

// Declared before '/:id' so "me" is never parsed as an id.
router.get('/me', authenticate, asyncHandler(userController.me));
router.put(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(userController.updateMe)
);

// Rate limited: verifying the current password is a brute-force target.
router.put(
  '/me/password',
  authenticate,
  authRateLimiter(),
  validate(changePasswordSchema),
  asyncHandler(userController.changePassword)
);

// Self, or any user when the requester is an ADMIN.
router.get('/:id', authenticate, asyncHandler(userController.getById));

module.exports = router;
