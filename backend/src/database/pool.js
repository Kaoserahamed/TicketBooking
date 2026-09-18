'use strict';

/**
 * MySQL connection pool (mysql2/promise).
 *
 * MySQL is the source of truth for ticket inventory and requires the strong
 * transactional guarantees described in docs/03-database-design.md, so every
 * module obtains connections from this shared InnoDB pool.
 */

const mysql = require('mysql2/promise');
const config = require('../config/env');

const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  waitForConnections: true,
  connectionLimit: config.database.connectionLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  // Keep DECIMAL/BIGINT as strings so monetary values and IDs never lose precision.
  decimalNumbers: false,
});

/**
 * Verify that the API can reach MySQL and return basic server metadata.
 *
 * @returns {Promise<{connected: boolean, host: string, port: number, database: string, version: string, tables: number, checkedAt: string}>}
 * @throws {Error} when the connection cannot be established (e.g. bad
 *   credentials, MySQL down, or an unknown database).
 */
async function testConnection() {
  const connection = await pool.getConnection();
  try {
    const [serverRows] = await connection.query(
      'SELECT DATABASE() AS database_name, VERSION() AS version'
    );
    const [tableRows] = await connection.query(
      `SELECT COUNT(*) AS table_count
         FROM information_schema.tables
        WHERE table_schema = DATABASE()`
    );

    return {
      connected: true,
      host: config.database.host,
      port: config.database.port,
      database: serverRows[0].database_name ?? config.database.name,
      version: serverRows[0].version,
      tables: Number(tableRows[0].table_count),
      checkedAt: new Date().toISOString(),
    };
  } finally {
    connection.release();
  }
}

/**
 * Close every pooled connection. Used on shutdown and by scripts/tests that
 * must let the Node.js process exit.
 *
 * @returns {Promise<void>}
 */
async function closePool() {
  await pool.end();
}

module.exports = { pool, testConnection, closePool };
