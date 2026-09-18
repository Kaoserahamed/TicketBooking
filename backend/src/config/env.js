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
};

module.exports = config;
