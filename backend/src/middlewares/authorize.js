'use strict';

/**
 * Middleware: role-based access control (docs/11-security.md §11.1).
 *
 * Roles are enforced server-side; hiding a route in the frontend is never
 * sufficient. Must run after `authenticate`.
 *
 * Usage:
 *   router.get('/admin/events', authenticate, authorize('ADMIN', 'EVENT_MANAGER'), handler)
 */

const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

/**
 * @param {...string} allowedRoles roles permitted to reach the route
 * @returns {import('express').RequestHandler}
 */
function authorize(...allowedRoles) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      // Programming error: authorize() was mounted without authenticate().
      return next(new UnauthorizedError('Authentication required', 'UNAUTHORIZED'));
    }

    if (allowedRoles.length === 0 || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return next(
      new ForbiddenError(
        `Role '${req.user.role}' is not permitted to access this resource`,
        'INSUFFICIENT_ROLE'
      )
    );
  };
}

module.exports = authorize;
