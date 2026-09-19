'use strict';

/**
 * Unit tests: the backend coverage gate itself.
 *
 * `npm run test:coverage` only means something if the parser reads the right
 * column of Node's coverage table and the floor comparison actually fails on a
 * regression. Both are pure functions, so they are covered here with a captured
 * table rather than by running (and mis-reading) a real suite.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  FLOORS,
  parseSummary,
  findBreaches,
  formatSummary,
} = require('../../scripts/check-coverage');

/** A miniature copy of the table Node prints, header and all. */
const TABLE = [
  '# start of coverage report',
  '# ---------------------------------------------------------------',
  '# file                        | line % | branch % | funcs % | uncovered lines',
  '# ---------------------------------------------------------------',
  '# src/app.js                  | 100.00 |    60.00 |  100.00 |',
  '# ---------------------------------------------------------------',
  '# all files                   |  61.87 |    92.16 |   38.16 |',
  '# ---------------------------------------------------------------',
  '# end of coverage report',
].join('\n');

test('parseSummary reads the aggregate row by column', () => {
  assert.deepEqual(parseSummary(TABLE), { lines: 61.87, branches: 92.16, functions: 38.16 });
});

test('parseSummary tolerates CRLF output', () => {
  assert.deepEqual(parseSummary(TABLE.replace(/\n/g, '\r\n')), {
    lines: 61.87,
    branches: 92.16,
    functions: 38.16,
  });
});

test('parseSummary returns null when the report is missing', () => {
  assert.equal(parseSummary('# tests 12\n# pass 12\n# fail 0'), null);
});

test('parseSummary returns null on a truncated aggregate row', () => {
  assert.equal(parseSummary('# all files                   |  61.87 |'), null);
});

test('findBreaches accepts a summary above every floor', () => {
  assert.deepEqual(findBreaches({ lines: 90, branches: 95, functions: 80 }), []);
});

test('findBreaches reports each metric that dips below its floor', () => {
  const breaches = findBreaches({ lines: 40, branches: 50, functions: 10 });
  assert.equal(breaches.length, 3);
  assert.match(breaches[0], /^lines: 40% is below the 55% floor$/);
  assert.match(breaches[1], /^branches: 50% is below the 80% floor$/);
  assert.match(breaches[2], /^functions: 10% is below the 30% floor$/);
});

test('findBreaches fails closed when there is no summary at all', () => {
  assert.deepEqual(findBreaches(null), ['no coverage summary found in the test output']);
});

test('formatSummary shows every metric next to its floor', () => {
  assert.equal(
    formatSummary({ lines: 61.87, branches: 92.16, functions: 38.16 }),
    'lines 61.87% (floor 55%), branches 92.16% (floor 80%), functions 38.16% (floor 30%)'
  );
});

test('every floor is a sane percentage', () => {
  Object.entries(FLOORS).forEach(([metric, floor]) => {
    assert.ok(Number.isFinite(floor), `${metric} floor must be a number`);
    assert.ok(floor > 0 && floor < 100, `${metric} floor ${floor} must be between 0 and 100`);
  });
});

test('npm run test:coverage delegates to this gate', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf8')
  );
  assert.equal(pkg.scripts['test:coverage'], 'node scripts/check-coverage.js');
});
