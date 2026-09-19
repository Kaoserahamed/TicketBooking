'use strict';

/**
 * Migration runner.
 *
 *   npm run db:migrate        (from the backend/ directory)
 *
 * Applies every *.sql file in infrastructure/database/migrations in filename
 * order and records it in `schema_migrations`, so re-running is a no-op. This
 * exists because PowerShell has no `<` input redirection for the mysql CLI.
 *
 * Note: `.\tests\run-sql-tests.ps1 -Fresh` rebuilds the whole database from
 * infrastructure/database/schema.sql, which already contains every migration's
 * result - the migrations are idempotent, so re-applying them is harmless.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const config = require('../src/config/env');

const migrationsDir = path.resolve(
  __dirname,
  '..',
  '..',
  'infrastructure',
  'database',
  'migrations'
);

const CREATE_TRACKING_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
      name        VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

async function main() {
  if (!fs.existsSync(migrationsDir)) {
    console.log(`[migrate] no migrations directory at ${migrationsDir}`);
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.toLowerCase().endsWith('.sql'))
    .sort();

  console.log('---------------------------------------------------------');
  console.log(' Ticket Booking System - database migrations');
  console.log('---------------------------------------------------------');
  console.log(
    ` database : ${config.database.name} @ ${config.database.host}:${config.database.port}`
  );
  console.log(` files    : ${files.length}`);
  console.log('---------------------------------------------------------');

  const connection = await mysql.createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
    // Migrations contain several statements per file.
    multipleStatements: true,
  });

  try {
    await connection.query(CREATE_TRACKING_TABLE);

    const [rows] = await connection.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.name));

    let appliedCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  SKIP   ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);

      console.log(`  APPLY  ${file}`);
      appliedCount += 1;
    }

    console.log('---------------------------------------------------------');
    console.log(` applied: ${appliedCount}   skipped: ${files.length - appliedCount}`);
    console.log('---------------------------------------------------------');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`[migrate] failed: ${error.message}`);
  process.exitCode = 1;
});
