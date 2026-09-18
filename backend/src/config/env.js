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
    maxAgeMs: toInt(process.env.REFRESH_COOKIE_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000),
  },
  // Redis is optional: docs/08-infrastructure-caching.md lists it for caching,
  // rate limiting and distributed locks. When REDIS_URL is absent the API runs
  // with in-process equivalents so local development needs no extra service.
  cache: {
    url: process.env.REDIS_URL || '',
    enabled: Boolean(process.env.REDIS_URL),
    connectTimeoutMs: toInt(process.env.REDIS_CONNECT_TIMEOUT_MS, 2000),
  },
  // Transactional email (docs/10-infrastructure-notifications.md).
  mail: {
    // 'console' logs messages (development), 'smtp' delivers via nodemailer.
    // Empty = auto: smtp when SMTP_HOST is configured, otherwise console.
    transport: process.env.MAIL_TRANSPORT || '',
    host: process.env.SMTP_HOST || '',
    port: toInt(process.env.SMTP_PORT, 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.MAIL_FROM || 'Ticket Booking <no-reply@ticketbooking.local>',
  },
  // Account recovery / verification flows.
  account: {
    // Off by default so enabling it is an explicit decision.
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
    emailVerificationTtlMinutes: toInt(process.env.EMAIL_VERIFICATION_TTL_MINUTES, 24 * 60),
    passwordResetTtlMinutes: toInt(process.env.PASSWORD_RESET_TTL_MINUTES, 60),
    // Used to build the links inside verification/reset emails.
    appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
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
