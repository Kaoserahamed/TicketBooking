'use strict';

/**
 * Service layer - account recovery: email verification and password reset.
 *
 * Kept separate from auth.service.js, which owns session/token handling.
 * Implements docs/11-security.md §11.2: single-use, expiring, hashed tokens and
 * session revocation after a password change.
 */

const config = require('../config/env');
const userRepository = require('../repositories/user.repository');
const refreshTokenRepository = require('../repositories/refresh-token.repository');
const actionTokenRepository = require('../repositories/user-action-token.repository');
const mailService = require('./mail.service');
const { hashPassword, verifyPassword } = require('../utils/password');
const { generateOpaqueToken, hashToken } = require('../utils/token');
const { toPublicUser } = require('../utils/serialize');
const { ConflictError, UnauthorizedError } = require('../utils/errors');

const { PURPOSES } = actionTokenRepository;

/**
 * Create a single-use token. Any outstanding token for the same purpose is
 * invalidated so only the newest link works.
 *
 * @param {{id: number, name: string, email: string}} user
 * @param {'EMAIL_VERIFICATION'|'PASSWORD_RESET'} purpose
 * @returns {Promise<string>} the raw token (only its hash is stored)
 */
async function issueActionToken(user, purpose) {
  const token = generateOpaqueToken();
  const ttlMinutes =
    purpose === PURPOSES.EMAIL_VERIFICATION
      ? config.account.emailVerificationTtlMinutes
      : config.account.passwordResetTtlMinutes;

  await actionTokenRepository.invalidateActiveForUser(user.id, purpose);
  await actionTokenRepository.create({
    userId: user.id,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
  });

  return token;
}

/**
 * Send (or re-send) the verification email for a user.
 *
 * @param {{id: number, name: string, email: string}} user
 * @returns {Promise<{sent: boolean, token: string}>}
 */
async function sendVerificationEmail(user) {
  const token = await issueActionToken(user, PURPOSES.EMAIL_VERIFICATION);
  await mailService.sendMail(
    mailService.buildVerificationEmail({ name: user.name, email: user.email, token })
  );
  return { sent: true, token };
}

/**
 * Issue a verification email for a newly registered account.
 *
 * A delivery failure must not fail registration, so errors are reported and
 * swallowed.
 *
 * @param {{id: number, name: string, email: string}} user
 * @returns {Promise<void>}
 */
async function sendVerificationEmailSafely(user) {
  try {
    await sendVerificationEmail(user);
  } catch (error) {
    console.error(`[account] could not send verification email to ${user.email}: ${error.message}`);
  }
}

/**
 * Confirm an email address using a verification token.
 *
 * @param {{token: string}} input
 * @returns {Promise<{user: object}>}
 */
async function verifyEmail(input) {
  const invalid = () =>
    new UnauthorizedError('Invalid or expired verification token', 'INVALID_VERIFICATION_TOKEN');

  const stored = await actionTokenRepository.findByHash(hashToken(input.token));

  if (
    !stored ||
    stored.purpose !== PURPOSES.EMAIL_VERIFICATION ||
    stored.used_at ||
    new Date(stored.expires_at) <= new Date()
  ) {
    throw invalid();
  }

  // Consume the token first: the UPDATE is guarded by `used_at IS NULL`, so a
  // concurrent replay can only succeed once.
  const consumed = await actionTokenRepository.markUsed(stored.id);
  if (!consumed) {
    throw invalid();
  }

  await userRepository.markEmailVerified(stored.user_id);

  const user = await userRepository.findById(stored.user_id);
  await actionTokenRepository.deleteExpired();

  return { user: toPublicUser(user) };
}

/**
 * Re-send a verification email to an authenticated user.
 *
 * @param {number|string} userId
 * @returns {Promise<{sent: boolean}>}
 */
async function resendVerification(userId) {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new UnauthorizedError('Account no longer exists', 'ACCOUNT_NOT_FOUND');
  }
  if (user.email_verified_at) {
    throw new ConflictError('This email address is already verified', 'EMAIL_ALREADY_VERIFIED');
  }

  await sendVerificationEmail(user);
  return { sent: true };
}

/**
 * Start a password reset.
 *
 * Always resolves successfully, whether or not the email exists, so the endpoint
 * cannot be used to discover registered addresses.
 *
 * @param {{email: string}} input
 * @returns {Promise<{sent: boolean}>}
 */
async function requestPasswordReset(input) {
  const email = String(input.email).trim().toLowerCase();
  const user = await userRepository.findByEmail(email);

  // Suspended/blocked accounts are treated as non-existent for this flow.
  if (!user || user.status !== 'ACTIVE') {
    return { sent: false };
  }

  const token = await issueActionToken(user, PURPOSES.PASSWORD_RESET);
  await mailService.sendMail(
    mailService.buildPasswordResetEmail({ name: user.name, email: user.email, token })
  );

  return { sent: true };
}

/**
 * Complete a password reset.
 *
 * @param {{token: string, newPassword: string}} input
 * @returns {Promise<{user: object}>}
 */
async function resetPassword(input) {
  const invalid = () =>
    new UnauthorizedError('Invalid or expired reset token', 'INVALID_RESET_TOKEN');

  const stored = await actionTokenRepository.findByHash(hashToken(input.token));

  if (
    !stored ||
    stored.purpose !== PURPOSES.PASSWORD_RESET ||
    stored.used_at ||
    new Date(stored.expires_at) <= new Date()
  ) {
    throw invalid();
  }

  const consumed = await actionTokenRepository.markUsed(stored.id);
  if (!consumed) {
    throw invalid();
  }

  const passwordHash = await hashPassword(input.newPassword);
  await userRepository.updatePassword(stored.user_id, passwordHash);

  // A password change invalidates every existing session and any other
  // outstanding reset link.
  await refreshTokenRepository.revokeAllForUser(stored.user_id);
  await actionTokenRepository.invalidateActiveForUser(stored.user_id, PURPOSES.PASSWORD_RESET);
  await actionTokenRepository.deleteExpired();

  const user = await userRepository.findById(stored.user_id);

  return { user: toPublicUser(user) };
}

module.exports = {
  PURPOSES,
  sendVerificationEmail,
  sendVerificationEmailSafely,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
};
