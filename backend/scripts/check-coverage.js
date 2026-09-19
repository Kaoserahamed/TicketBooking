'use strict';

/**
 * Coverage gate for the hermetic backend unit suite.
 *
 * `npm run test:coverage` runs `tests/unit/` (no MySQL, no Redis) under Node's
 * coverage reporter and then checks the aggregate row against the floors below.
 * Deleting tests or adding an untested branch therefore fails with a non-zero
 * exit code, which is what turns coverage from a report nobody reads into a
 * gate the CI backend job can enforce.
 *
 * The floors describe the *unit* suite only: services and repositories are
 * exercised by `tests/integration/`, which needs MySQL, so the aggregate here
 * is deliberately lower than the end-to-end number.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const BACKEND_DIR = path.resolve(__dirname, '..');

const FLOORS = { lines: 55, branches: 80, functions: 30 };

/**
 * Aggregate row of Node's coverage table (`# all files | line % | branch % |
 * funcs % | uncovered lines`), or `null` when the report is absent.
 *
 * @param {string} output
 * @returns {{lines: number, branches: number, functions: number}|null}
 */
function parseSummary(output) {
  const row = output.split(/\r?\n/).find((line) => /^#\s+all files\s*\|/.test(line));

  if (!row) {
    return null;
  }

  const numbers = row
    .split('|')
    .slice(1)
    .map((cell) => Number.parseFloat(cell.trim()))
    .filter((value) => Number.isFinite(value));

  if (numbers.length < 3) {
    return null;
  }

  return { lines: numbers[0], branches: numbers[1], functions: numbers[2] };
}

/**
 * Human-readable floor breaches, or `[]` when the summary passes.
 *
 * @param {{lines: number, branches: number, functions: number}|null} summary
 * @param {{lines: number, branches: number, functions: number}} [floors]
 * @returns {string[]}
 */
function findBreaches(summary, floors = FLOORS) {
  if (!summary) {
    return ['no coverage summary found in the test output'];
  }

  return Object.keys(floors)
    .filter((metric) => summary[metric] < floors[metric])
    .map((metric) => `${metric}: ${summary[metric]}% is below the ${floors[metric]}% floor`);
}

/**
 * One line showing every metric next to its floor.
 *
 * @param {{lines: number, branches: number, functions: number}} summary
 * @param {{lines: number, branches: number, functions: number}} [floors]
 * @returns {string}
 */
function formatSummary(summary, floors = FLOORS) {
  return Object.keys(floors)
    .map((metric) => `${metric} ${summary[metric]}% (floor ${floors[metric]}%)`)
    .join(', ');
}

/** Run the unit suite, echo its output, then enforce FLOORS. */
function main() {
  const result = spawnSync(
    process.execPath,
    ['--test', '--experimental-test-coverage', 'tests/unit/'],
    {
      cwd: BACKEND_DIR,
      encoding: 'utf8',
    }
  );

  const output = `${result.stdout || ''}${result.stderr || ''}`;
  process.stdout.write(output);

  if (result.status !== 0) {
    console.error(`\nThe unit suite failed (exit ${result.status}); coverage was not checked.`);
    process.exit(result.status === null ? 1 : result.status);
  }

  const summary = parseSummary(output);
  const breaches = findBreaches(summary);

  if (breaches.length > 0) {
    console.error(`\nCoverage gate failed:\n  - ${breaches.join('\n  - ')}`);
    process.exit(1);
  }

  console.log(`\nCoverage gate passed: ${formatSummary(summary)}`);
}

module.exports = { FLOORS, parseSummary, findBreaches, formatSummary };

if (require.main === module) {
  main();
}
