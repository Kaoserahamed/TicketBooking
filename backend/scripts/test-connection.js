'use strict';

/**
 * Standalone MySQL connectivity check.
 *
 *   npm run db:check          (from the backend/ directory)
 *
 * Prints the resolved connection settings (never the password) and the result
 * of a live `SELECT DATABASE(), VERSION()`. Exits 0 when the connection works
 * and 1 when it fails, so it can be used in CI.
 */

const config = require('../src/config/env');
const { testConnection, closePool } = require('../src/database/pool');

const line = '---------------------------------------------------------';

async function main() {
  const { host, port, user, name, password } = config.database;

  console.log(line);
  console.log(' Ticket Booking System - database connection test');
  console.log(line);
  console.log(` host     : ${host}:${port}`);
  console.log(` user     : ${user}`);
  console.log(` database : ${name}`);
  console.log(` password : ${password ? '******** (set)' : '(not set)'}`);
  console.log(line);

  try {
    const info = await testConnection();
    console.log(' RESULT   : OK');
    console.log(` MySQL    : ${info.version}`);
    console.log(` tables   : ${info.tables} found in "${info.database}"`);
    console.log(` checked  : ${info.checkedAt}`);
    console.log(line);
    process.exitCode = 0;
  } catch (error) {
    console.error(` RESULT   : FAILED - ${error.message}`);
    console.error('');
    console.error(' Things to check:');
    console.error('   1. Is the MySQL service running?           (Get-Service *mysql*)');
    console.error('   2. Do DB_HOST/DB_PORT/DB_USER/DB_PASSWORD in .env match your server?');
    console.error('   3. Does the database exist? Recreate it with:');
    console.error('        .\\tests\\run-sql-tests.ps1 -Fresh');
    console.error(line);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main().catch(async (error) => {
  console.error('[db:check] unexpected failure:', error);
  process.exitCode = 1;
});