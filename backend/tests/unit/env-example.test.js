'use strict';

/**
 * Unit tests: `.env.example` stays in sync with the code.
 *
 * Every `process.env.X` read by src/ or scripts/ must be documented in
 * `.env.example`, otherwise a fresh clone cannot be configured from the README
 * alone. This test is what keeps recommendation "fill in missing env vars" from
 * regressing the next time a feature adds configuration.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BACKEND_DIR = path.resolve(__dirname, '..', '..');
const EXAMPLE_FILE = path.resolve(BACKEND_DIR, '..', '.env.example');
const SOURCE_DIRS = [path.join(BACKEND_DIR, 'src'), path.join(BACKEND_DIR, 'scripts')];

/** Recursively list .js files below a directory. */
function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return jsFiles(full);
    }
    return entry.isFile() && entry.name.endsWith('.js') ? [full] : [];
  });
}

/** Names read through `process.env.NAME` (static access only). */
function envVarsUsedInSource() {
  const used = new Set();
  SOURCE_DIRS.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      return;
    }
    jsFiles(dir).forEach((file) => {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
        used.add(match[1]);
      }
    });
  });
  return used;
}

/** KEY=VALUE pairs declared in .env.example (comments and blanks ignored). */
function declaredVars() {
  const lines = fs.readFileSync(EXAMPLE_FILE, 'utf8').split(/\r?\n/);
  const declared = new Map();
  lines.forEach((line, index) => {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (match) {
      const key = match[1];
      declared.set(key, declared.has(key) ? [...declared.get(key), index + 1] : [index + 1]);
    }
  });
  return declared;
}

test('.env.example exists and parses as KEY=VALUE', () => {
  assert.ok(fs.existsSync(EXAMPLE_FILE), '.env.example must exist at the repository root');
  const declared = declaredVars();
  assert.ok(declared.size > 20, 'the template should document the full configuration surface');
});

test('every environment variable read by the code is documented', () => {
  const declared = declaredVars();
  const missing = [...envVarsUsedInSource()].filter((name) => !declared.has(name)).sort();

  assert.deepEqual(
    missing,
    [],
    `these variables are read in code but missing from .env.example: ${missing.join(', ')}`
  );
});

test('.env.example declares no duplicate keys', () => {
  const duplicates = [...declaredVars().entries()]
    .filter(([, lineNumbers]) => lineNumbers.length > 1)
    .map(([key, lineNumbers]) => `${key} (lines ${lineNumbers.join(', ')})`);

  assert.deepEqual(duplicates, []);
});

test('.env.example never contains a real-looking credential', () => {
  const contents = fs.readFileSync(EXAMPLE_FILE, 'utf8');
  // Placeholder values only - live keys and connection strings are a red flag.
  ['sk_live_', 'sk_test_', 'AKIA', 'BEGIN RSA PRIVATE KEY', 'postgres://', 'mysql://'].forEach(
    (pattern) => {
      assert.ok(!contents.includes(pattern), `.env.example must not contain ${pattern}`);
    }
  );
});
