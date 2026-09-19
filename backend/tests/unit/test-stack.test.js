'use strict';

/**
 * Unit tests: the throwaway test stack stays in sync with the backend.
 *
 * `docker-compose.test.yml` and `backend/.env.test.example` are what make the
 * integration suites runnable from a fresh clone, so the two files have to
 * agree on the database name, user, password and host port. A silent edit to
 * one of them (a renamed database, a re-published port) would otherwise only
 * surface as a confusing connection error for the next contributor, so this
 * suite parses both files and asserts they describe the same stack.
 *
 * It follows the same "documentation is executable" idea as
 * `env-example.test.js`: no YAML dependency, just the declarations that must
 * not drift.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BACKEND_DIR = path.resolve(__dirname, '..', '..');
const REPO_ROOT = path.resolve(BACKEND_DIR, '..');
const COMPOSE_FILE = path.join(REPO_ROOT, 'docker-compose.test.yml');
const ENV_TEMPLATE = path.join(BACKEND_DIR, '.env.test.example');
const README_FILE = path.join(REPO_ROOT, 'README.md');

/** Read a file, failing the test with a readable message when it is absent. */
function read(file) {
  assert.ok(fs.existsSync(file), `${path.relative(REPO_ROOT, file)} must exist`);
  return fs.readFileSync(file, 'utf8');
}

/** KEY=VALUE pairs declared in a template (comments and blanks ignored). */
function declaredVars(file) {
  const declared = new Map();
  read(file)
    .split(/\r?\n/)
    .forEach((line) => {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (match) {
        declared.set(match[1], match[2].trim());
      }
    });
  return declared;
}

/**
 * Value of a `service: ... KEY: value` declaration inside a compose service
 * block, e.g. `MYSQL_DATABASE: ticket_booking_test` under `mysql:`.
 */
function composeServiceValue(contents, service, key) {
  const serviceMatch = new RegExp(`^\\s{2}${service}:\\s*$`, 'm').exec(contents);
  assert.ok(serviceMatch, `docker-compose.test.yml must declare a \`${service}\` service`);

  const rest = contents.slice(serviceMatch.index + serviceMatch[0].length);
  const nextService = /^\s{2}\S/m.exec(rest);
  const block = nextService ? rest.slice(0, nextService.index) : rest;

  const valueMatch = new RegExp(`^\\s+${key}:\\s*(.+?)\\s*$`, 'm').exec(block);
  assert.ok(valueMatch, `${service} must declare \`${key}\``);
  return valueMatch[1].replace(/^["']|["']$/g, '');
}

/** Default host port of a `"${VAR:-port}:containerPort"` publish entry. */
function defaultPublishedPort(contents, service) {
  const published = composeServiceValue(contents, service, 'ports');
  const match = /\$\{[A-Z_]+:-(\d+)\}:\d+/.exec(published);
  assert.ok(match, `${service} must publish a host port with an overridable default`);
  return match[1];
}

test('the test stack declares MySQL and Redis services', () => {
  const compose = read(COMPOSE_FILE);
  assert.match(compose, /^\s{2}mysql:\s*$/m);
  assert.match(compose, /^\s{2}redis:\s*$/m);
  // Both are third-party images: nothing custom to build, so a clone with no
  // Docker cache still starts in seconds.
  assert.match(compose, /image:\s*mysql:8\.0/);
  assert.match(compose, /image:\s*redis:/);
});

test('the test stack seeds the schema so integration tests have tables', () => {
  const compose = read(COMPOSE_FILE);
  assert.match(compose, /infrastructure\/database\/schema\.sql:\/docker-entrypoint-initdb\.d\//);
});

test('the test stack publishes non-default ports to coexist with a dev stack', () => {
  const compose = read(COMPOSE_FILE);
  // 3306/6379 stay free for `docker compose up`; the test stack uses 3307/6380.
  assert.equal(defaultPublishedPort(compose, 'mysql'), '3307');
  assert.equal(defaultPublishedPort(compose, 'redis'), '6380');
});

test('.env.test.example points at the throwaway stack', () => {
  const template = declaredVars(ENV_TEMPLATE);

  assert.equal(template.get('NODE_ENV'), 'test');
  assert.equal(template.get('DB_HOST'), '127.0.0.1');
  assert.equal(template.get('DB_PORT'), '3307');
  assert.equal(template.get('DB_NAME'), 'ticket_booking_test');
  assert.equal(template.get('DB_USER'), 'tbs_test');
  assert.equal(template.get('DB_PASSWORD'), 'test-db-password');
  assert.match(template.get('REDIS_URL') || '', /^redis:\/\/.*:6380$/);
});

test('the template and the compose stack agree on database credentials', () => {
  const compose = read(COMPOSE_FILE);
  const template = declaredVars(ENV_TEMPLATE);

  assert.equal(template.get('DB_NAME'), composeServiceValue(compose, 'mysql', 'MYSQL_DATABASE'));
  assert.equal(template.get('DB_USER'), composeServiceValue(compose, 'mysql', 'MYSQL_USER'));
  assert.equal(
    template.get('DB_PASSWORD'),
    composeServiceValue(compose, 'mysql', 'MYSQL_PASSWORD')
  );
  assert.equal(template.get('DB_PORT'), defaultPublishedPort(compose, 'mysql'));
});

test('.env.test.example declares no real-looking credential', () => {
  const contents = read(ENV_TEMPLATE);
  // Test-only placeholders: a live key or a hosted connection string is a red flag.
  ['sk_live_', 'sk_test_', 'AKIA', 'BEGIN RSA PRIVATE KEY'].forEach((pattern) => {
    assert.ok(!contents.includes(pattern), `.env.test.example must not contain ${pattern}`);
  });
});

test('the README documents how to run the suites against the stack', () => {
  const readme = read(README_FILE);
  assert.match(readme, /docker compose -f docker-compose\.test\.yml up -d/);
  assert.match(readme, /backend\/\.env\.test\.example/);
  assert.match(readme, /docker compose -f docker-compose\.test\.yml down -v/);
});
