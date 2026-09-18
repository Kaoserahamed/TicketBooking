'use strict';

/**
 * 404 handler for unmatched routes. Keeps responses JSON and consistent with
 * docs/04-api-design.md (Content-Type: application/json).
 */
module.exports = function notFound(req, res) {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};