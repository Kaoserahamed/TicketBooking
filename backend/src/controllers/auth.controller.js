'use strict';

/**
 * Controller layer - HTTP translation only.
 *
 * Controllers read the (already validated) request, call a service, and shape
 * the response. No business rules and no SQL live here.
 */

const config = require('../config/env');
const authService = require('../services/auth.service');
const accountService = require('../services/account.service');
const { UnauthorizedError } = require('../utils/errors');

/**
 * Build the request metadata recorded against a refresh token (audit trail).
 *
 * @param {import('express').Request} req
 * @returns {{userAgent: string|null, ipAddress: string|null}}
 */
function requestMeta(req) {
  return {
    userAgent: req.get('user-agent') || null,
    ipAddress: req.ip || null,
  };
}

/**
 * Attach the refresh token as an httpOnly cookie (docs/11-security.md §11.1).
 * The cookie is scoped to the auth routes and is not readable by JavaScript.
 *
 * @param {import('express').Response} res
 * @param {string} refreshToken
 */
function setRefreshCookie(res, refreshToken) {
  res.cookie(config.cookie.name, refreshToken, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: config.cookie.path,
    maxAge: config.cookie.maxAgeMs,
  });
}

/**
 * Clear the refresh cookie (logout).
 *
 * @param {import('express').Response} res
 */
function clearRefreshCookie(res) {
  res.clearCookie(config.cookie.name, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: config.cookie.path,
  });
}

/**
 * Resolve the refresh token from the cookie, falling back to the body so
 * non-browser clients (and tests) can pass it explicitly.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function resolveRefreshToken(req) {
  const fromCookie = req.cookies ? req.cookies[config.cookie.name] : null;
  return fromCookie || (req.body && req.body.refreshToken) || null;
}

/** POST /api/v1/auth/register */
async function register(req, res) {
  const { user, tokens } = await authService.register(req.body, requestMeta(req));
  setRefreshCookie(res, tokens.refreshToken);
  res.status(201).json({ status: 'ok', user, tokens });
}

/** POST /api/v1/auth/login */
async function login(req, res) {
  const { user, tokens } = await authService.login(req.body, requestMeta(req));
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ status: 'ok', user, tokens });
}

/** POST /api/v1/auth/refresh */
async function refresh(req, res) {
  const refreshToken = resolveRefreshToken(req);
  if (!refreshToken) {
    throw new UnauthorizedError('Refresh token is required', 'MISSING_REFRESH_TOKEN');
  }

  const { user, tokens } = await authService.refresh({ refreshToken }, requestMeta(req));
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ status: 'ok', user, tokens });
}

/** POST /api/v1/auth/logout */
async function logout(req, res) {
  await authService.logout({ refreshToken: resolveRefreshToken(req) });
  clearRefreshCookie(res);
  res.json({ status: 'ok', message: 'Logged out' });
}

/** GET /api/v1/auth/me */
async function me(req, res) {
  const user = await authService.getProfile(req.user.id);
  res.json({ status: 'ok', user });
}

/** POST /api/v1/auth/verify-email */
async function verifyEmail(req, res) {
  const { user } = await accountService.verifyEmail(req.body);
  res.json({ status: 'ok', message: 'Email address verified', user });
}

/** POST /api/v1/auth/resend-verification */
async function resendVerification(req, res) {
  await accountService.resendVerification(req.user.id);
  res.json({ status: 'ok', message: 'Verification email sent' });
}

/**
 * POST /api/v1/auth/forgot-password
 *
 * Always returns the same response, whether or not the address is registered,
 * so the endpoint cannot be used to enumerate accounts.
 */
async function forgotPassword(req, res) {
  await accountService.requestPasswordReset(req.body);
  res.json({
    status: 'ok',
    message: 'If that email address is registered, a password reset link has been sent.',
  });
}

/** POST /api/v1/auth/reset-password */
async function resetPassword(req, res) {
  const { user } = await accountService.resetPassword(req.body);
  // Any session tied to the old password is now invalid.
  clearRefreshCookie(res);
  res.json({ status: 'ok', message: 'Password reset. Please sign in again.', user });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};
