'use strict';

/**
 * Wrap an async route handler so a rejected promise is forwarded to the Express
 * error handler instead of escaping as an unhandled rejection.
 *
 * @param {Function} handler async (req, res, next) => any
 * @returns {Function} express-compatible handler
 */
module.exports = function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};
