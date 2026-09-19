'use strict';

/**
 * Unit tests: the unit suite stays hermetic.
 *
 * `npm test` from the repository root must run on a machine with no MySQL, no
 * Redis and no Docker. `tests/unit/` is what makes that claim true: a file in
 * this directory may open an HTTP socket to an Express app it boots itself,
 * but it must never touch the network services the backend integrates with.
 *
 * Allowed: importing `src/database/pool` for `closePool` only, to release
 * idle pooled handles so the test process can exit (see `app.test.js`). The
 * pool is lazy - requiring it opens no connection - and this file fails the
 * suite if any unit test actually *uses* it.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const UNIT_DIR = path.join(REPO_ROOT, 'backend', 'tests', 'unit');
const ROOT_MANIFEST = path.join(REPO_ROOT, 'package.json');
const ROOT_README = path.join(REPO_ROOT, 'README.md');

const FORBIDDEN_MODULES = ['mysql2', 'redis', 'rate-limit-redis', 'nodemailer', 'ioredis'];

/** Source text of every unit test file, in sorted filename order. */
function unitFiles() {
  return fs
    .readdirSync(UNIT_DIR)
    .filter((name) => name.endsWith('.test.js'))
    .sort()
    .map((name) => ({ name, text: fs.readFileSync(path.join(UNIT_DIR, name), 'utf8') }));
}

test('no unit test requires a network-service client', () => {
  unitFiles().forEach(({ name, text }) => {
    FORBIDDEN_MODULES.forEach((moduleName) => {
      const direct = new RegExp(`require\\(['"]${moduleName}(\\/[^'"]*)?['"]\\)`);
      assert.ok(!direct.test(text), `${name} must not require ${moduleName}`);
    });
    assert.ok(!/require\(['"]ioredis['"]\)/.test(text), `${name} must not require ioredis`);
  });
});

test('the only sanctioned database import is closePool for process cleanup', () => {
  unitFiles().forEach(({ name, text }) => {
    if (!text.includes('database/pool')) {
      return;
    }
    assert.ok(
      /closePool/.test(text),
      `${name}: the only reason to import database/pool in a unit test is closePool`
    );
    FORBIDDEN_MODULES.forEach((moduleName) => {
      assert.ok(
        !text.includes(`require('${moduleName}')`) && !text.includes(`require("${moduleName}")`),
        `${name}: closePool does not justify requiring ${moduleName}`
      );
    });
  });
});

test('no unit test performs a database query', () => {
  unitFiles().forEach(({ name, text }) => {
    assert.ok(!/pool\.(execute|query|getConnection)\(/.test(text), `${name} must not query MySQL`);
    assert.ok(
      !/await fetch\(['"]https?:\/\/(?!127\.0\.0\.1|localhost)/.test(text),
      `${name} must only fetch localhost`
    );
  });
});

test('the backend unit script targets the hermetic directory', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'backend', 'package.json'), 'utf8')
  );
  assert.ok(
    manifest.scripts['test:unit'].includes('tests/unit/'),
    'backend test:unit must run tests/unit/ only'
  );
});

test('the root suite documents and wires the hermetic command', () => {
  const root = JSON.parse(fs.readFileSync(ROOT_MANIFEST, 'utf8'));
  assert.ok(root.scripts.test.includes('test:unit'), 'root npm test must include the unit suite');
  assert.ok(!/test:integration/.test(root.scripts.test), 'root npm test must not need MySQL');
  const readme = fs.readFileSync(ROOT_README, 'utf8');
  assert.match(
    readme,
    /npm test\s+# hermetic|hermetic suites only/,
    'README must say npm test is hermetic'
  );
  assert.match(readme, /no MySQL, no Redis/, 'README must name the services npm test avoids');
});
