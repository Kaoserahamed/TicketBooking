'use strict';

/**
 * Central error handler. Express only treats a 4-argument function as error
 * middleware, so `next` must stay in the signature even though it is unused.
 *
 * Every error leaving the API has the same shape (docs/04-api-design.md §4.1):
 *   { "status": "error", "message": "...", "code": "...", "errors": [...] }
 *
 * Unexpected (5xx) failures are written to the structured log with the request
 * id and reported to the error tracker when one is configured
 * (docs/15-observability.md).
 */

const { logger } = require('../utils/logger');
const { captureException } = require('../utils/error-tracking');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  let status = Number.isInteger(err.status) ? err.status : 500;
  let message = err.message;
  let code = err.code;

  // express.json() raises this when the body is not valid JSON.
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body';
    code = 'INVALID_JSON';
  }

  // body-parser payload limits
  if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
    code = 'PAYLOAD_TOO_LARGE';
  }

  const isServerError = status >= 500;

  if (isServerError) {
    logger.error(
      {
        err,
        reqId: req.id,
        method: req.method,
        url: req.originalUrl,
        statusCode: status,
      },
      'unhandled request error'
    );
    captureException(err, { requestId: req.id, method: req.method, url: req.originalUrl });
  }

  const payload = {
    status: 'error',
    // Never leak internal details for unexpected failures.
    message: isServerError ? 'Internal server error' : message,
  };

  if (!isServerError && code) {
    payload.code = code;
  }

  // Field-level validation errors (src/utils/errors.js -> ValidationError).
  if (!isServerError && Array.isArray(err.details)) {
    payload.errors = err.details;
  }

  res.status(status).json(payload);
};
