'use strict';

/**
 * 404 handler for unmatched routes. Keeps responses JSON and consistent with
 * docs/04-api-design.md §4.1 - the same envelope as every other error
 * (`status`/`message`/`code`), using the code returned by NotFoundError.
 */
module.exports = function notFound(req, res) {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};
