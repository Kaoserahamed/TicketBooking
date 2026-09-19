'use strict';

/**
 * Middleware: verify a Bearer access token and attach the authenticated user to
 * `req.user` (docs/11-security.md §11.1).
 *
 * Only the token is trusted - never a client-supplied user id or role.
 */

const { verifyAccessToken, ACCESS_TOKEN_TYPE } = require('../utils/token');
const userRepository = require('../repositories/user.repository');
const { UnauthorizedError } = require('../utils/errors');
const asyncHandler = require('../utils/async-handler');

/**
 * Extract a Bearer token from the Authorization header.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim();
}

const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req);

  if (!token) {
    throw new UnauthorizedError('Missing Bearer access token', 'MISSING_ACCESS_TOKEN');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError' ? 'Access token has expired' : 'Invalid access token';
    throw new UnauthorizedError(message, 'INVALID_ACCESS_TOKEN');
  }

  if (payload.type !== ACCESS_TOKEN_TYPE) {
    throw new UnauthorizedError('Invalid access token', 'INVALID_ACCESS_TOKEN');
  }

  // Re-read the account so role/status changes take effect immediately and a
  // deleted user cannot keep using a valid token.
  const user = await userRepository.findById(payload.sub);
  if (!user) {
    throw new UnauthorizedError('Account no longer exists', 'ACCOUNT_NOT_FOUND');
  }
  if (user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Account is not active', 'ACCOUNT_NOT_ACTIVE');
  }

  req.user = {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };

  next();
});

module.exports = authenticate;
module.exports.extractBearerToken = extractBearerToken;
