'use strict';

/**
 * Central error handler. Express only treats a 4-argument function as error
 * middleware, so `next` must stay in the signature even though it is unused.
 */
// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  const status = Number.isInteger(err.status) ? err.status : 500;

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} ->`, err);
  }

  res.status(status).json({
    status: 'error',
    // Never leak internal details for unexpected failures.
    message: status >= 500 ? 'Internal server error' : err.message,
  });
};