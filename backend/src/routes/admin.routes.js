'use strict';

/**
 * Route layer - admin endpoints (docs/04-api-design.md §4.8).
 *
 * Every route requires a valid access token AND an allowed role: RBAC is
 * enforced server-side, never by hiding frontend routes
 * (docs/11-security.md §11.1).
 */

const express = require('express');
const adminController = require('../controllers/admin.controller');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { listUsersQuerySchema } = require('../validators/auth.validator');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

// GET /api/v1/admin/users?role=&status=&limit=
router.get(
  '/users',
  authenticate,
  authorize('ADMIN'),
  validate(listUsersQuerySchema, 'query'),
  asyncHandler(adminController.listUsers)
);

module.exports = router;