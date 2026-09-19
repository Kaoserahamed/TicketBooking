'use strict';

/**
 * Give the seeded development accounts a real, loggable password.
 *
 *   npm run seed:passwords            (from the backend/ directory)
 *   SEED_PASSWORD=MyPass123 npm run seed:passwords
 *
 * The hashes in tests/sql/01-seed-data.sql are placeholders for a fresh
 * database; this script fixes an already-populated database without a
 * destructive `run-sql-tests.ps1 -Fresh` reset.
 *
 * A distinct bcrypt hash (and therefore salt) is generated per user.
 */

const config = require('../src/config/env');
const { pool, closePool } = require('../src/database/pool');
const { hashPassword, verifyPassword } = require('../src/utils/password');

const DEV_PASSWORD = process.env.SEED_PASSWORD || 'Password123';

const SEED_EMAILS = [
  'admin@ticketbooking.test',
  'alice@example.com',
  'bob@example.com',
  'carol@example.com',
  'david@example.com',
  'eve@venue.com',
  'grace@example.com',
];

async function main() {
  console.log('---------------------------------------------------------');
  console.log(' Ticket Booking System - reset seeded account passwords');
  console.log('---------------------------------------------------------');
  console.log(` database : ${config.database.name}`);
  console.log(` password : ${DEV_PASSWORD}`);
  console.log('---------------------------------------------------------');

  let updated = 0;
  let missing = 0;

  for (const email of SEED_EMAILS) {
    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);

    if (rows.length === 0) {
      console.log(`  SKIP    ${email} (not in this database)`);
      missing += 1;
      continue;
    }

    const passwordHash = await hashPassword(DEV_PASSWORD);
    await pool.execute(
      `UPDATE users
          SET password_hash = ?,
              email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP())
        WHERE id = ?`,
      [passwordHash, rows[0].id]
    );

    // Prove the stored hash really matches before moving on.
    const [check] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [
      rows[0].id,
    ]);
    const ok = await verifyPassword(DEV_PASSWORD, check[0].password_hash);

    console.log(`  UPDATE  ${email} (verify=${ok})`);
    updated += 1;
  }

  console.log('---------------------------------------------------------');
  console.log(` updated: ${updated}   skipped: ${missing}`);
  console.log(' sign in with:  <email> / ' + DEV_PASSWORD);
  console.log('---------------------------------------------------------');
}

main()
  .catch((error) => {
    console.error('[seed:passwords] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
