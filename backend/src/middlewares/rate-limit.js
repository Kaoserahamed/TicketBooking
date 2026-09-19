'use strict';

/**
 * Middleware: per-IP rate limiting for authentication routes
 * (docs/13-scaling.md §13.6).
 *
 * Credential endpoints are the most brute-forceable surface in the API, so they
 * get a much tighter budget than the general IP limit.
 *
 * Store selection:
 *   * Redis (via `rate-limit-redis`) when REDIS_URL is configured and reachable -
 *     required for a correct limit across multiple API instances
 *     (docs/08-infrastructure-caching.md lists rate limiting as a Redis use case).
 *   * express-rate-limit's in-process MemoryStore otherwise.
 *
 * `initRateLimitStore()` is called once at startup (src/index.js). If Redis is
 * down the API keeps serving with the in-memory store rather than failing
 * closed, which would take the whole booking flow offline.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const { getRedisClient } = require('../cache/redis');

const KEY_PREFIX = 'rl:auth:';

/** @type {import('express-rate-limit').Store|undefined} undefined = use MemoryStore */
let redisStore;

/**
 * Build a Redis-backed store for a client, or `undefined` when there is no
 * client (so express-rate-limit falls back to its default MemoryStore).
 *
 * Exported for direct testing - constructing the store needs no live server.
 *
 * @param {import('redis').RedisClientType|null} client
 * @returns {import('express-rate-limit').Store|undefined}
 */
function createRateLimitStore(client) {
  if (!client) {
    return undefined;
  }

  const { RedisStore } = require('rate-limit-redis');

  return new RedisStore({
    // node-redis expects sendCommand(...args), rate-limit-redis passes an array.
    sendCommand: (...args) => client.sendCommand(args),
    prefix: KEY_PREFIX,
  });
}

/**
 * Connect Redis (if configured) and switch the limiter to a shared store.
 *
 * @param {import('redis').RedisClientType|null} [clientOverride] injectable for tests
 * @returns {Promise<boolean>} true when the shared store is active
 */
async function initRateLimitStore(clientOverride = undefined) {
  const client = clientOverride === undefined ? await getRedisClient() : clientOverride;
  redisStore = createRateLimitStore(client);

  if (redisStore) {
    console.log('[rate-limit] using the Redis store (shared across instances)');
    return true;
  }

  console.log('[rate-limit] using the in-process store (single instance only)');
  return false;
}

/** Reset the resolved store (tests only). */
function resetRateLimitStore() {
  redisStore = undefined;
}

/**
 * Limit applied to register/login/refresh/logout plus the recovery endpoints.
 *
 * Disabled under NODE_ENV=test so the automated suite is not throttled. Pass
 * `{ force: true, ... }` (used by the rate-limit tests) to build a real limiter
 * in any environment.
 *
 * @param {{force?: boolean, windowMs?: number, limit?: number, useResolvedStore?: boolean}} [overrides]
 * @returns {import('express').RequestHandler}
 */
function authRateLimiter(overrides = {}) {
  const { force = false, useResolvedStore = true, ...options } = overrides;

  if (config.env === 'test' && !force) {
    return (req, res, next) => next();
  }

  return rateLimit({
    windowMs: config.security.authRateLimit.windowMs,
    limit: config.security.authRateLimit.max,
    store: useResolvedStore ? redisStore : undefined,
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

module.exports = {
  authRateLimiter,
  createRateLimitStore,
  initRateLimitStore,
  resetRateLimitStore,
};
