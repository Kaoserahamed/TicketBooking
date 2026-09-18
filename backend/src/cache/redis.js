'use strict';

/**
 * Redis client (optional infrastructure).
 *
 * docs/08-infrastructure-caching.md uses Redis for caching, rate limiting and
 * distributed locks. It is intentionally optional here: when REDIS_URL is not
 * set - or the server is unreachable - the API falls back to in-process
 * behaviour instead of refusing to start, so local development needs no extra
 * service. Callers must therefore always check the returned client for `null`.
 */

const { createClient } = require('redis');
const config = require('../config/env');

/** @type {import('redis').RedisClientType|null|undefined} undefined = not attempted yet */
let client;
let warned = false;

/**
 * Return a connected Redis client, or `null` when Redis is unavailable.
 *
 * The connection is attempted once; repeated calls reuse the same handle.
 *
 * @returns {Promise<import('redis').RedisClientType|null>}
 */
async function getRedisClient() {
  if (client !== undefined) {
    return client;
  }

  if (!config.cache.enabled) {
    client = null;
    return client;
  }

  const candidate = createClient({
    url: config.cache.url,
    socket: { connectTimeout: config.cache.connectTimeoutMs, reconnectStrategy: false },
  });

  // Without a listener, a connection error would crash the process.
  candidate.on('error', (error) => {
    if (!warned) {
      warned = true;
      console.warn(`[redis] error: ${error.message}`);
    }
  });

  try {
    await candidate.connect();
    console.log(`[redis] connected to ${config.cache.url}`);
    client = candidate;
  } catch (error) {
    console.warn(
      `[redis] unavailable (${error.message}) - falling back to in-process behaviour`
    );
    try {
      await candidate.disconnect();
    } catch (disconnectError) {
      // Already closed - nothing to do.
    }
    client = null;
  }

  return client;
}

/**
 * Close the Redis connection if one was opened.
 *
 * @returns {Promise<void>}
 */
async function closeRedis() {
  if (client) {
    await client.quit();
    client = undefined;
  }
}

module.exports = { getRedisClient, closeRedis };
