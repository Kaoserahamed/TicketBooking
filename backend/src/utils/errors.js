'use strict';

/**
 * Application error types.
 *
 * Services throw these; the central error handler (src/middlewares/error-handler.js)
 * turns them into consistent JSON responses. This keeps HTTP concerns out of the
 * service layer - a service never touches `res`.
 */

class AppError extends Error {
  /**
   * @param {string} message   safe, client-facing message
   * @param {number} status    HTTP status code
   * @param {string} [code]    machine-readable error code
   * @param {object} [details] extra payload (e.g. field validation errors)
   */
  constructor(message, status, code, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code || 'ERROR';
    this.details = details;
    Error.captureStackTrace(this, AppError);
  }
}

/** 400 - malformed or invalid request. */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', details) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/** 401 - not authenticated (missing/invalid/expired credentials). */
class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(message, 401, code);
    this.name = 'UnauthorizedError';
  }
}

/** 403 - authenticated but not permitted. */
class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action', code = 'FORBIDDEN') {
    super(message, 403, code);
    this.name = 'ForbiddenError';
  }
}

/** 404 - resource does not exist. */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
    this.name = 'NotFoundError';
  }
}

/** 409 - conflicts with existing state (duplicate email/phone). */
class ConflictError extends AppError {
  constructor(message = 'Resource already exists', code = 'CONFLICT') {
    super(message, 409, code);
    this.name = 'ConflictError';
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};
