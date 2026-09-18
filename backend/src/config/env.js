'use strict';

/**
 * Environment configuration.
 *
 * Values are read from the repository-root `.env` (the file documented in the
 * README). A `backend/.env` file, when present, takes precedence so a
 * developer can override values for the API only.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const repoRootEnv = path.resolve(__dirname, '..', '..', '..', '.env');
const backendEnv = path.resolve(__dirname, '..', '..', '.env');

[repoRootEnv, backendEnv].forEach((envPath) => {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: envPath === backendEnv });
  }
});

/**
 * Parse an integer environment value, falling back when it is absent/invalid.
 *
 * @param {string|undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 4000),
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    // DB_PASSWORD is preferred; MY_SQL_PASSWORD is the legacy key kept for
    // backwards compatibility with existing local .env files.
    password: process.env.DB_PASSWORD ?? process.env.MY_SQL_PASSWORD ?? '',
    name: process.env.DB_NAME || 'ticket_booking',
    connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
  },
  // docs/11-security.md §11.1 - JWT access token + refresh token.
  jwt: {
    accessSecret: process.env.JWT_SECRET || '',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'ticket-booking-api',
  },
  security: {
    // docs/11-security.md §11.2 - secure password hashing (bcrypt).
    bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 10),
    // docs/13-scaling.md §13.6 - per-IP rate limiting on authentication routes.
    authRateLimit: {
      windowMs: toInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
      max: toInt(process.env.AUTH_RATE_LIMIT_MAX, 20),
    },
  },
  // Refresh token cookie: httpOnly + SameSite mitigate token theft and CSRF
  // (docs/11-security.md §11.2). `secure` is enabled outside development.
  cookie: {
    name: process.env.REFRESH_COOKIE_NAME || 'tb_refresh_token',
    secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || 'strict',
    path: '/api/v1/auth',
  },
};

// Development/test fallbacks. These are deliberately rejected in production so a
// predictable secret can never reach a live deployment (docs/11-security.md §11.2).
const DEV_ACCESS_SECRET = 'dev-only-access-secret-change-me';
const DEV_REFRESH_SECRET = 'dev-only-refresh-secret-change-me';

if (!config.jwt.accessSecret) {
  if (config.env === 'production') {
    throw new Error('JWT_SECRET must be set when NODE_ENV=production');
  }
  config.jwt.accessSecret = DEV_ACCESS_SECRET;
}

if (!config.jwt.refreshSecret) {
  if (config.env === 'production') {
    throw new Error('JWT_REFRESH_SECRET must be set when NODE_ENV=production');
  }
  config.jwt.refreshSecret = DEV_REFRESH_SECRET;
}

if (config.env === 'production') {
  const weak = [DEV_ACCESS_SECRET, DEV_REFRESH_SECRET];
  if (weak.includes(config.jwt.accessSecret) || weak.includes(config.jwt.refreshSecret)) {
    throw new Error('Refusing to start: development JWT secrets are not allowed in production');
  }
}

module.exports = config;
