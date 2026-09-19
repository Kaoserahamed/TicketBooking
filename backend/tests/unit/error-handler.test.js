'use strict';

/**
 * Unit tests: the error envelope produced by src/middlewares/error-handler.js
 * (docs/04-api-design.md §4.1).
 *
 * The middleware is called directly with fake req/res objects so every branch is
 * covered without starting a server or touching a database.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const errorHandler = require('../../src/middlewares/error-handler');

function fakeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function fakeRequest() {
  return { method: 'POST', originalUrl: '/api/v1/bookings/hold', id: 'req-test' };
}

test('client errors keep their message, code and field details', () => {
  const res = fakeResponse();
  const error = Object.assign(new Error('Validation failed'), {
    status: 400,
    code: 'VALIDATION_ERROR',
    details: [{ field: 'seats', message: 'Select at least one seat' }],
  });

  errorHandler(error, fakeRequest(), res, () => {});

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    status: 'error',
    message: 'Validation failed',
    code: 'VALIDATION_ERROR',
    errors: [{ field: 'seats', message: 'Select at least one seat' }],
  });
});

test('server errors never leak internals', () => {
  const res = fakeResponse();
  const error = new Error('ECONNREFUSED 127.0.0.1:3306 - mysql credentials rejected');

  errorHandler(error, fakeRequest(), res, () => {});

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { status: 'error', message: 'Internal server error' });
  assert.ok(!JSON.stringify(res.body).includes('ECONNREFUSED'));
});

test('malformed JSON bodies become 400 INVALID_JSON', () => {
  const res = fakeResponse();
  const error = Object.assign(new SyntaxError('Unexpected token'), {
    type: 'entity.parse.failed',
  });

  errorHandler(error, fakeRequest(), res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'INVALID_JSON');
});

test('oversized bodies become 413 PAYLOAD_TOO_LARGE', () => {
  const res = fakeResponse();
  const error = Object.assign(new Error('request entity too large'), {
    type: 'entity.too.large',
  });

  errorHandler(error, fakeRequest(), res, () => {});

  assert.equal(res.statusCode, 413);
  assert.equal(res.body.code, 'PAYLOAD_TOO_LARGE');
});

test('a non-integer status falls back to 500', () => {
  const res = fakeResponse();
  const error = Object.assign(new Error('weird'), { status: 'teapot' });

  errorHandler(error, fakeRequest(), res, () => {});

  assert.equal(res.statusCode, 500);
});
