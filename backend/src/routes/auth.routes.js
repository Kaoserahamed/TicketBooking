'use strict';

/**
 * Route layer - authentication endpoints (docs/04-api-design.md §4.2).
 *
 * Mounted at /api/v1/auth by src/app.js. Routes only wire middleware and
 * controllers together; all logic lives in the service layer.
 */

const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const { authRateLimiter } = require('../middlewares/rate-limit');
const {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} = require('../validators/auth.validator');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

// POST /api/v1/auth/register - create an account and sign in
router.post(
  '/register',
  authRateLimiter(),
  validate(registerSchema),
  asyncHandler(authController.register)
);

// POST /api/v1/auth/login - exchange credentials for a token pair
router.post(
  '/login',
  authRateLimiter(),
  validate(loginSchema),
  asyncHandler(authController.login)
);

// POST /api/v1/auth/refresh - rotate the refresh token
router.post(
  '/refresh',
  authRateLimiter(),
  validate(refreshTokenSchema),
  asyncHandler(authController.refresh)
);

// POST /api/v1/auth/logout - revoke the refresh token
router.post(
  '/logout',
  authRateLimiter(),
  validate(refreshTokenSchema),
  asyncHandler(authController.logout)
);

// GET /api/v1/auth/me - the authenticated user's profile
router.get('/me', authenticate, asyncHandler(authController.me));

module.exports = router;