'use strict';

/**
 * Middleware: per-IP rate limiting for authentication routes
 * (docs/13-scaling.md §13.6).
 *
 * Credential endpoints are the most brute-forceable surface in the API, so they
 * get a much tighter budget than the general IP limit.
 *
 * Note: the default store is in-process. Running multiple API instances behind a
 * load balancer requires a shared store (Redis - docs/08-infrastructure-caching.md
 * lists "rate limiting" as a Redis use case); see the note in the README.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config/env');

/**
 * Limit applied to register/login/refresh/logout.
 *
 * Disabled under NODE_ENV=test so the automated suite is not throttled. Pass
 * `{ force: true }` (used by the dedicated rate-limit test) to build a real
 * limiter in any environment.
 *
 * @param {{force?: boolean, windowMs?: number, limit?: number}} [overrides]
 * @returns {import('express').RequestHandler}
 */
function authRateLimiter(overrides = {}) {
  const { force = false, ...options } = overrides;

  if (config.env === 'test' && !force) {
    return (req, res, next) => next();
  }

  return rateLimit({
    windowMs: config.security.authRateLimit.windowMs,
    limit: config.security.authRateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      status: 'error',
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please try again later.',
    },
    ...options,
    // Never let overrides silently disable the protection.
    skip: () => false,
  });
}

module.exports = { authRateLimiter };