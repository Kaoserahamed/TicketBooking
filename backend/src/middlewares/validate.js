'use strict';

/**
 * Middleware factory: validate a request section against a Zod schema and
 * replace it with the parsed value.
 *
 * On failure the request never reaches the controller - it is rejected with a
 * 400 carrying per-field messages (src/utils/errors.js -> ValidationError).
 */

const { ValidationError } = require('../utils/errors');

/**
 * @param {import('zod').ZodType} schema
 * @param {'body'|'query'|'params'} [source]
 * @returns {import('express').RequestHandler}
 */
function validate(schema, source = 'body') {
  return function validateMiddleware(req, res, next) {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.length ? issue.path.join('.') : source,
        message: issue.message,
      }));

      return next(new ValidationError(`Invalid request ${source}`, details));
    }

    if (source === 'body') {
      // Assigning the parsed object drops unknown keys before the service sees them.
      req.body = result.data;
    } else if (source === 'query') {
      // `req.query` is a getter in Express, so the parsed value is exposed separately.
      req.validatedQuery = result.data;
    } else {
      req.validatedParams = result.data;
    }

    return next();
  };
}

module.exports = validate;