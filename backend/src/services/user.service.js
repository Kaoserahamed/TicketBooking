'use strict';

/**
 * Service layer - user profile management and administration
 * (docs/02-system-architecture.md §2.4 "users (profile management)",
 * docs/04-api-design.md §4.8).
 */

const userRepository = require('../repositories/user.repository');
const refreshTokenRepository = require('../repositories/refresh-token.repository');
const accountService = require('./account.service');
const { hashPassword, verifyPassword } = require('../utils/password');
const { toPublicUser } = require('../utils/serialize');
const {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} = require('../utils/errors');

/**
 * List users for the admin dashboard, optionally filtered by role/status.
 *
 * @param {{role?: string, status?: string, limit?: number}} [filters]
 * @returns {Promise<{users: object[], total: number}>}
 */
async function listUsers(filters = {}) {
  const rows = await userRepository.list(filters);
  return { users: rows.map(toPublicUser), total: rows.length };
}

/**
 * Read a profile by id.
 *
 * @param {number|string} userId
 * @returns {Promise<object>} public user
 * @throws {NotFoundError}
 */
async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  }
  return toPublicUser(user);
}

/**
 * Read a profile on behalf of a requester.
 *
 * A user may only read their own profile; only ADMIN may read someone else's.
 * This ownership check is what stops IDOR (`GET /users/{id}` enumeration).
 *
 * @param {number|string} targetId
 * @param {{id: number, role: string}} requester
 * @returns {Promise<object>} public user
 * @throws {ForbiddenError|NotFoundError}
 */
async function getProfileForRequester(targetId, requester) {
  const isSelf = Number(targetId) === Number(requester.id);

  if (!isSelf && requester.role !== 'ADMIN') {
    throw new ForbiddenError('You may only access your own profile', 'INSUFFICIENT_ROLE');
  }

  return getProfile(targetId);
}

/**
 * Update the signed-in user's profile.
 *
 * Changing the email address resets verification and sends a fresh
 * verification link, because the new address has not been proven.
 *
 * @param {number|string} userId
 * @param {{name?: string, email?: string, phone?: string|null}} changes
 * @returns {Promise<object>} updated public user
 */
async function updateProfile(userId, changes) {
  const current = await userRepository.findById(userId);
  if (!current) {
    throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  }

  const updates = {};
  let emailChanged = false;

  if (changes.name !== undefined) {
    updates.name = String(changes.name).trim();
  }

  if (changes.email !== undefined) {
    const email = String(changes.email).trim().toLowerCase();
    if (email !== current.email) {
      const existing = await userRepository.findByEmail(email);
      if (existing && Number(existing.id) !== Number(userId)) {
        throw new ConflictError('An account with this email already exists', 'EMAIL_ALREADY_REGISTERED');
      }
      updates.email = email;
      emailChanged = true;
    }
  }

  if (changes.phone !== undefined) {
    const phone = changes.phone === null ? null : String(changes.phone).trim();
    if (phone && phone !== current.phone) {
      const existing = await userRepository.findByPhone(phone);
      if (existing && Number(existing.id) !== Number(userId)) {
        throw new ConflictError('An account with this phone number already exists', 'PHONE_ALREADY_REGISTERED');
      }
    }
    if (phone !== current.phone) {
      updates.phone = phone;
    }
  }

  if (Object.keys(updates).length > 0) {
    try {
      await userRepository.updateProfile(userId, updates);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        const field = /phone/i.test(error.message) ? 'phone number' : 'email';
        throw new ConflictError(`An account with this ${field} already exists`, 'DUPLICATE_ACCOUNT');
      }
      throw error;
    }
  }

  const updated = await userRepository.findById(userId);

  if (emailChanged) {
    await userRepository.clearEmailVerified(userId);
    // Best-effort: a mail failure must not roll back a successful profile update.
    await accountService.sendVerificationEmailSafely(toPublicUser(updated));
    updated.email_verified_at = null;
  }

  return toPublicUser(updated);
}

/**
 * Change the signed-in user's password after verifying the current one.
 *
 * All refresh tokens are revoked so a previously stolen token cannot outlive the
 * old password (docs/11-security.md §11.2).
 *
 * @param {number|string} userId
 * @param {{currentPassword: string, newPassword: string}} input
 * @returns {Promise<void>}
 */
async function changePassword(userId, input) {
  const user = await userRepository.findAuthById(userId);

  if (!user) {
    throw new UnauthorizedError('Account no longer exists', 'ACCOUNT_NOT_FOUND');
  }

  const matches = await verifyPassword(input.currentPassword, user.password_hash);
  if (!matches) {
    throw new UnauthorizedError('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
  }

  const passwordHash = await hashPassword(input.newPassword);
  await userRepository.updatePassword(userId, passwordHash);
  await refreshTokenRepository.revokeAllForUser(userId);
}

module.exports = {
  listUsers,
  getProfile,
  getProfileForRequester,
  updateProfile,
  changePassword,
};