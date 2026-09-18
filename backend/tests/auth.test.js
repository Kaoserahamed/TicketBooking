'use strict';

/**
 * Authentication API tests (Node.js built-in test runner - `npm test`).
 *
 * These are end-to-end tests: a real Express app, a real MySQL database and
 * real HTTP requests, exercising the whole layered stack
 * (routes -> controller -> service -> repository -> MySQL).
 *
 * Fixtures use unique emails/phones and are removed in `after()`, so the suite
 * is repeatable against the development database.
 */

process.env.NODE_ENV = 'test';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const createApp = require('../src/app');
const config = require('../src/config/env');
const { pool, closePool } = require('../src/database/pool');
const { hashPassword } = require('../src/utils/password');
const { authRateLimiter } = require('../src/middlewares/rate-limit');

// ---------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------
const stamp = `${Date.now()}${Math.floor(Math.random() * 100)}`;
const PASSWORD = 'Secret123';

const primaryEmail = `auth.test.${stamp}@example.com`;
const suspendedEmail = `auth.suspended.${stamp}@example.com`;
const adminEmail = `auth.admin.${stamp}@example.com`;
const phoneBase = String(Date.now()).slice(-12);

const createdEmails = [primaryEmail, suspendedEmail, adminEmail];

let server;
let baseUrl;

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
/**
 * Perform an API request and return status, parsed body and raw headers.
 *
 * @param {string} path
 * @param {{method?: string, body?: object, token?: string, cookie?: string}} [options]
 */
async function api(path, options = {}) {
  const headers = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.cookie) {
    headers.Cookie = options.cookie;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (error) {
    json = null;
  }

  const setCookie =
    typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];

  return { status: res.status, body: json, text, setCookie };
}

/** Extract the refresh cookie as a `Cookie:` header value. */
function refreshCookieHeader(setCookie) {
  const raw = setCookie.find((cookie) => cookie.startsWith(`${config.cookie.name}=`));
  return raw ? raw.split(';')[0] : null;
}

/**
 * Insert a user directly, bypassing the API (for role/status fixtures).
 */
async function insertUser({ name, email, phone, role, status, password }) {
  const passwordHash = await hashPassword(password);
  const [result] = await pool.execute(
    `INSERT INTO users (name, email, phone, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, email, phone, passwordHash, role, status]
  );
  return result.insertId;
}

// ---------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------
before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  await insertUser({
    name: 'Suspended User',
    email: suspendedEmail,
    phone: `${phoneBase}02`,
    role: 'USER',
    status: 'SUSPENDED',
    password: PASSWORD,
  });

  await insertUser({
    name: 'Admin User',
    email: adminEmail,
    phone: `${phoneBase}03`,
    role: 'ADMIN',
    status: 'ACTIVE',
    password: PASSWORD,
  });
});

after(async () => {
  // Deleting users cascades to refresh_tokens (FK ON DELETE CASCADE).
  if (createdEmails.length) {
    const placeholders = createdEmails.map(() => '?').join(', ');
    await pool.execute(`DELETE FROM users WHERE email IN (${placeholders})`, createdEmails);
  }

  await new Promise((resolve) => server.close(resolve));
  await closePool();
});

// ---------------------------------------------------------------
// POST /api/v1/auth/register
// ---------------------------------------------------------------
describe('POST /api/v1/auth/register', () => {
  test('creates an account and returns a token pair', async () => {
    const { status, body, setCookie } = await api('/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Primary Tester',
        email: primaryEmail,
        phone: `${phoneBase}01`,
        password: PASSWORD,
      },
    });

    assert.equal(status, 201);
    assert.equal(body.status, 'ok');
    assert.equal(body.user.email, primaryEmail);
    assert.equal(body.user.name, 'Primary Tester');
    assert.equal(body.user.role, 'USER');
    assert.equal(body.user.status, 'ACTIVE');
    assert.ok(body.tokens.accessToken, 'access token should be returned');
    assert.ok(body.tokens.refreshToken, 'refresh token should be returned');
    assert.equal(body.tokens.tokenType, 'Bearer');

    // The password hash must never be exposed.
    assert.equal(body.user.password_hash, undefined);
    assert.equal(JSON.stringify(body).includes('password_hash'), false);

    // Refresh token is also set as an httpOnly cookie (docs/11-security.md §11.1).
    const cookie = setCookie.find((c) => c.startsWith(`${config.cookie.name}=`));
    assert.ok(cookie, 'refresh cookie should be set');
    assert.match(cookie, /HttpOnly/i);
  });

  test('stores the password as a bcrypt hash, never plaintext', async () => {
    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE email = ?', [
      primaryEmail,
    ]);

    assert.equal(rows.length, 1);
    assert.match(rows[0].password_hash, /^\$2[aby]\$\d{2}\$/);
    assert.notEqual(rows[0].password_hash, PASSWORD);
  });

  test('ignores a client-supplied role (no privilege escalation)', async () => {
    const email = `auth.role.${stamp}@example.com`;
    createdEmails.push(email);

    const { status, body } = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { name: 'Sneaky', email, password: PASSWORD, role: 'ADMIN', status: 'ACTIVE' },
    });

    assert.equal(status, 201);
    assert.equal(body.user.role, 'USER');
  });

  test('rejects a duplicate email with 409', async () => {
    const { status, body } = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { name: 'Duplicate', email: primaryEmail, password: PASSWORD },
    });

    assert.equal(status, 409);
    assert.equal(body.status, 'error');
    assert.equal(body.code, 'EMAIL_ALREADY_REGISTERED');
  });

  test('rejects a duplicate phone with 409', async () => {
    const { status, body } = await api('/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Duplicate Phone',
        email: `auth.phone.${stamp}@example.com`,
        phone: `${phoneBase}01`,
        password: PASSWORD,
      },
    });

    assert.equal(status, 409);
    assert.equal(body.code, 'PHONE_ALREADY_REGISTERED');
  });

  test('rejects invalid input with 400 and field-level errors', async () => {
    const { status, body } = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { name: 'A', email: 'not-an-email', password: 'short' },
    });

    assert.equal(status, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(body.errors));

    const fields = body.errors.map((e) => e.field);
    assert.ok(fields.includes('email'));
    assert.ok(fields.includes('password'));
    assert.ok(fields.includes('name'));
  });

  test('rejects a password without a number or letter', async () => {
    const { status, body } = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { name: 'Weak Password', email: `auth.weak.${stamp}@example.com`, password: 'abcdefgh' },
    });

    assert.equal(status, 400);
    assert.ok(body.errors.some((e) => e.field === 'password'));
  });
});

// ---------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------
describe('POST /api/v1/auth/login', () => {
  test('returns tokens for valid credentials', async () => {
    const { status, body } = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail, password: PASSWORD },
    });

    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.user.email, primaryEmail);
    assert.ok(body.tokens.accessToken);
    assert.ok(body.tokens.refreshToken);
    assert.equal(JSON.stringify(body).includes('password_hash'), false);
  });

  test('accepts a differently-cased email', async () => {
    const { status, body } = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail.toUpperCase(), password: PASSWORD },
    });

    assert.equal(status, 200);
    assert.equal(body.user.email, primaryEmail);
  });

  test('rejects a wrong password with 401', async () => {
    const { status, body } = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail, password: 'WrongPass123' },
    });

    assert.equal(status, 401);
    assert.equal(body.code, 'INVALID_CREDENTIALS');
  });

  test('does not reveal whether an email is registered', async () => {
    const { status, body } = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: `nobody.${stamp}@example.com`, password: PASSWORD },
    });

    // Same status and message as a wrong password - no account enumeration.
    assert.equal(status, 401);
    assert.equal(body.code, 'INVALID_CREDENTIALS');
    assert.equal(body.message, 'Invalid email or password');
  });

  test('rejects a suspended account with 403', async () => {
    const { status, body } = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: suspendedEmail, password: PASSWORD },
    });

    assert.equal(status, 403);
    assert.equal(body.code, 'ACCOUNT_NOT_ACTIVE');
  });

  test('rejects a missing password with 400', async () => {
    const { status, body } = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail },
    });

    assert.equal(status, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('issues a refresh token that is persisted only as a hash', async () => {
    const { body } = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail, password: PASSWORD },
    });

    const [rows] = await pool.execute(
      `SELECT token_hash FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
        WHERE u.email = ? AND rt.revoked_at IS NULL`,
      [primaryEmail]
    );

    assert.ok(rows.length > 0, 'an active refresh token row should exist');
    const storedHashes = rows.map((row) => row.token_hash);
    // The raw token is never stored.
    assert.equal(storedHashes.includes(body.tokens.refreshToken), false);
    for (const hash of storedHashes) {
      assert.match(hash, /^[a-f0-9]{64}$/);
    }
  });
});

// ---------------------------------------------------------------
// GET /api/v1/auth/me
// ---------------------------------------------------------------
describe('GET /api/v1/auth/me', () => {
  test('returns the profile for a valid access token', async () => {
    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail, password: PASSWORD },
    });

    const { status, body } = await api('/api/v1/auth/me', {
      token: login.body.tokens.accessToken,
    });

    assert.equal(status, 200);
    assert.equal(body.user.email, primaryEmail);
    assert.equal(body.user.role, 'USER');
    assert.equal(body.user.password_hash, undefined);
  });

  test('rejects a request without a token', async () => {
    const { status, body } = await api('/api/v1/auth/me');

    assert.equal(status, 401);
    assert.equal(body.code, 'MISSING_ACCESS_TOKEN');
  });

  test('rejects a malformed token', async () => {
    const { status, body } = await api('/api/v1/auth/me', { token: 'not.a.jwt' });

    assert.equal(status, 401);
    assert.equal(body.code, 'INVALID_ACCESS_TOKEN');
  });

  test('rejects a refresh token used as an access token', async () => {
    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail, password: PASSWORD },
    });

    const { status, body } = await api('/api/v1/auth/me', {
      token: login.body.tokens.refreshToken,
    });

    assert.equal(status, 401);
    assert.equal(body.code, 'INVALID_ACCESS_TOKEN');
  });

  test('rejects a token whose signature was tampered with', async () => {
    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail, password: PASSWORD },
    });

    const [header, payload, signature] = login.body.tokens.accessToken.split('.');
    const tampered = `${header}.${payload}.${signature.slice(0, -2)}xx`;

    const { status, body } = await api('/api/v1/auth/me', { token: tampered });

    assert.equal(status, 401);
    assert.equal(body.code, 'INVALID_ACCESS_TOKEN');
  });
});

// ---------------------------------------------------------------
// POST /api/v1/auth/refresh
// ---------------------------------------------------------------
describe('POST /api/v1/auth/refresh', () => {
  test('rotates the refresh token', async () => {
    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail, password: PASSWORD },
    });

    const first = login.body.tokens.refreshToken;

    const { status, body } = await api('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: first },
    });

    assert.equal(status, 200);
    assert.ok(body.tokens.accessToken);
    assert.ok(body.tokens.refreshToken);
    // A brand new token is issued on every rotation.
    assert.notEqual(body.tokens.refreshToken, first);
  });

  test('accepts the refresh token from the httpOnly cookie', async () => {
    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail, password: PASSWORD },
    });

    const cookie = refreshCookieHeader(login.setCookie);
    assert.ok(cookie, 'login should set the refresh cookie');

    const { status, body } = await api('/api/v1/auth/refresh', {
      method: 'POST',
      cookie,
      body: {},
    });

    assert.equal(status, 200);
    assert.ok(body.tokens.accessToken);
  });

  test('detects reuse of a rotated token and revokes every session', async () => {
    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail, password: PASSWORD },
    });

    const first = login.body.tokens.refreshToken;

    const rotated = await api('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: first },
    });
    assert.equal(rotated.status, 200);

    const second = rotated.body.tokens.refreshToken;

    // Replaying the spent token is treated as theft.
    const replay = await api('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: first },
    });
    assert.equal(replay.status, 401);
    assert.equal(replay.body.code, 'REFRESH_TOKEN_REUSED');

    // The whole token family was revoked, so the newest token is dead too.
    const afterRevoke = await api('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: second },
    });
    assert.equal(afterRevoke.status, 401);
    assert.equal(afterRevoke.body.code, 'INVALID_REFRESH_TOKEN');
  });

  test('marks the rotated token as revoked in the database', async () => {
    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail, password: PASSWORD },
    });

    const { hashToken } = require('../src/utils/token');
    const tokenHash = hashToken(login.body.tokens.refreshToken);

    await api('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: login.body.tokens.refreshToken },
    });

    const [rows] = await pool.execute(
      'SELECT revoked_at, replaced_by_hash FROM refresh_tokens WHERE token_hash = ?',
      [tokenHash]
    );

    assert.equal(rows.length, 1);
    assert.ok(rows[0].revoked_at, 'the presented token should be revoked');
    assert.match(rows[0].replaced_by_hash, /^[a-f0-9]{64}$/);
  });

  test('rejects a missing refresh token', async () => {
    const { status, body } = await api('/api/v1/auth/refresh', { method: 'POST', body: {} });

    assert.equal(status, 401);
    assert.equal(body.code, 'MISSING_REFRESH_TOKEN');
  });

  test('rejects an invalid refresh token', async () => {
    const { status, body } = await api('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: 'not.a.jwt' },
    });

    assert.equal(status, 401);
    assert.equal(body.code, 'INVALID_REFRESH_TOKEN');
  });

  test('rejects an access token presented as a refresh token', async () => {
    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail, password: PASSWORD },
    });

    const { status, body } = await api('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: login.body.tokens.accessToken },
    });

    assert.equal(status, 401);
    assert.equal(body.code, 'INVALID_REFRESH_TOKEN');
  });
});

// ---------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------
describe('POST /api/v1/auth/logout', () => {
  test('revokes the refresh token and clears the cookie', async () => {
    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail, password: PASSWORD },
    });

    const refreshToken = login.body.tokens.refreshToken;

    const loggedOut = await api('/api/v1/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    });

    assert.equal(loggedOut.status, 200);
    assert.equal(loggedOut.body.status, 'ok');

    // The cookie is cleared on the way out.
    const cleared = loggedOut.setCookie.find((c) => c.startsWith(`${config.cookie.name}=`));
    assert.ok(cleared, 'logout should send a clearing cookie');
    assert.match(cleared, /Expires=Thu, 01 Jan 1970|Max-Age=0/i);

    // The revoked token can no longer be rotated.
    const afterLogout = await api('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
    assert.equal(afterLogout.status, 401);
  });

  test('is idempotent when no token is supplied', async () => {
    const { status, body } = await api('/api/v1/auth/logout', { method: 'POST', body: {} });

    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
  });
});

// ---------------------------------------------------------------
// RBAC - GET /api/v1/admin/users (docs/11-security.md §11.1)
// ---------------------------------------------------------------
describe('RBAC on GET /api/v1/admin/users', () => {
  test('rejects an unauthenticated request with 401', async () => {
    const { status, body } = await api('/api/v1/admin/users');

    assert.equal(status, 401);
    assert.equal(body.code, 'MISSING_ACCESS_TOKEN');
  });

  test('rejects a USER token with 403', async () => {
    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: primaryEmail, password: PASSWORD },
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, 'USER');

    const { status, body } = await api('/api/v1/admin/users', {
      token: login.body.tokens.accessToken,
    });

    assert.equal(status, 403);
    assert.equal(body.code, 'INSUFFICIENT_ROLE');
  });

  test('allows an ADMIN token and never leaks password hashes', async () => {
    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: adminEmail, password: PASSWORD },
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, 'ADMIN');

    const { status, body } = await api('/api/v1/admin/users', {
      token: login.body.tokens.accessToken,
    });

    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.ok(Array.isArray(body.users));
    assert.equal(body.total, body.users.length);
    assert.equal(JSON.stringify(body).includes('password_hash'), false);
  });

  test('filters users by role and validates the query', async () => {
    const login = await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: adminEmail, password: PASSWORD },
    });

    const filtered = await api('/api/v1/admin/users?role=ADMIN&limit=5', {
      token: login.body.tokens.accessToken,
    });

    assert.equal(filtered.status, 200);
    assert.ok(filtered.body.users.length >= 1);
    assert.ok(filtered.body.users.every((user) => user.role === 'ADMIN'));

    const invalid = await api('/api/v1/admin/users?role=SUPERUSER', {
      token: login.body.tokens.accessToken,
    });

    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, 'VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------
// Rate limiting (docs/13-scaling.md §13.6)
// ---------------------------------------------------------------
describe('authentication rate limiting', () => {
  test('blocks requests past the configured limit with 429', async () => {
    // The limiter is disabled under NODE_ENV=test, so build a real one on a
    // throwaway app to prove the middleware behaves as configured.
    const miniApp = express();
    miniApp.post(
      '/limited',
      authRateLimiter({ force: true, limit: 2, windowMs: 60_000 }),
      (req, res) => res.json({ status: 'ok' })
    );

    const miniServer = miniApp.listen(0);
    await new Promise((resolve) => miniServer.once('listening', resolve));
    const miniUrl = `http://127.0.0.1:${miniServer.address().port}/limited`;

    try {
      const first = await fetch(miniUrl, { method: 'POST' });
      const second = await fetch(miniUrl, { method: 'POST' });
      const third = await fetch(miniUrl, { method: 'POST' });

      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(third.status, 429);

      const body = await third.json();
      assert.equal(body.code, 'TOO_MANY_REQUESTS');
    } finally {
      await new Promise((resolve) => miniServer.close(resolve));
    }
  });
});
