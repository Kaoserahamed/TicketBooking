'use strict';

/**
 * Service layer - authentication business rules.
 *
 * This layer knows nothing about HTTP (no `req`/`res`) and nothing about SQL
 * (repositories do that). It throws `AppError` subclasses that the controller
 * and the central error handler translate into responses.
 *
 * Implements docs/11-security.md §11.1-11.2:
 *   - bcrypt password hashing
 *   - JWT access token (short lived) + refresh token (long lived)
 *   - refresh-token rotation with reuse detection
 *   - server-side account status enforcement
 */

const config = require('../config/env');
const userRepository = require('../repositories/user.repository');
const refreshTokenRepository = require('../repositories/refresh-token.repository');
const { hashPassword, verifyPassword } = require('../utils/password');
const {
  REFRESH_TOKEN_TYPE,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  getTokenExpiry,
} = require('../utils/token');
const { toPublicUser } = require('../utils/serialize');
const { ConflictError, ForbiddenError, UnauthorizedError } = require('../utils/errors');

const DEFAULT_ROLE = 'USER';

/**
 * A throwaway hash used to equalise response timing when an email does not
 * exist, so login cannot be used to enumerate registered accounts.
 * @type {Promise<string>|null}
 */
let dummyHashPromise = null;

function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('timing-equalisation-placeholder');
  }
  return dummyHashPromise;
}

/**
 * Normalise an email for storage/lookup consistency.
 *
 * @param {string} email
 * @returns {string}
 */
function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/**
 * Reject accounts that are not allowed to sign in.
 *
 * @param {object} user row with a `status` field
 * @throws {ForbiddenError}
 */
function assertAccountActive(user) {
  if (user.status === 'ACTIVE') {
    return;
  }

  throw new ForbiddenError(
    `Account is ${String(user.status).toLowerCase()} and cannot sign in. Contact support.`,
    'ACCOUNT_NOT_ACTIVE'
  );
}

/**
 * Issue a fresh access/refresh token pair and persist the refresh token hash.
 *
 * @param {{id: number|string, role: string, email: string}} user
 * @param {{userAgent?: string|null, ipAddress?: string|null}} [meta]
 * @returns {Promise<object>} token bundle
 */
async function issueTokens(user, meta = {}) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshTokenExpiresAt = getTokenExpiry(refreshToken);

  await refreshTokenRepository.store({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshTokenExpiresAt,
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  return {
    tokenType: 'Bearer',
    accessToken,
    refreshToken,
    accessTokenExpiresIn: config.jwt.accessExpiresIn,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
  };
}


/**
 * Register a new account (POST /api/v1/auth/register).
 *
 * The role is always USER: accepting a role from the client would be a
 * privilege-escalation hole (docs/11-security.md §11.1 - RBAC is server-side).
 *
 * @param {{name: string, email: string, phone?: string|null, password: string}} input
 * @param {{userAgent?: string|null, ipAddress?: string|null}} [meta]
 * @returns {Promise<{user: object, tokens: object}>}
 */
async function register(input, meta = {}) {
  const email = normalizeEmail(input.email);
  const phone = input.phone ? String(input.phone).trim() : null;

  // Friendly, specific conflicts (the UNIQUE constraints are the real guard).
  if (await userRepository.findByEmail(email)) {
    throw new ConflictError('An account with this email already exists', 'EMAIL_ALREADY_REGISTERED');
  }
  if (phone && (await userRepository.findByPhone(phone))) {
    throw new ConflictError('An account with this phone number already exists', 'PHONE_ALREADY_REGISTERED');
  }

  const passwordHash = await hashPassword(input.password);

  let userId;
  try {
    userId = await userRepository.create({
      name: String(input.name).trim(),
      email,
      phone,
      passwordHash,
      role: DEFAULT_ROLE,
    });
  } catch (error) {
    // Race-safe fallback: two concurrent registrations can pass the checks above.
    if (error.code === 'ER_DUP_ENTRY') {
      const field = /phone/i.test(error.message) ? 'phone number' : 'email';
      throw new ConflictError(`An account with this ${field} already exists`, 'DUPLICATE_ACCOUNT');
    }
    throw error;
  }

  const user = await userRepository.findById(userId);
  const tokens = await issueTokens(user, meta);

  return { user: toPublicUser(user), tokens };
}

/**
 * Authenticate with email + password (POST /api/v1/auth/login).
 *
 * @param {{email: string, password: string}} input
 * @param {{userAgent?: string|null, ipAddress?: string|null}} [meta]
 * @returns {Promise<{user: object, tokens: object}>}
 */
async function login(input, meta = {}) {
  const email = normalizeEmail(input.email);
  const user = await userRepository.findByEmail(email);

  if (!user) {
    // Spend comparable time so a missing account is indistinguishable from a
    // wrong password (account-enumeration protection).
    await verifyPassword(input.password, await getDummyHash());
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await verifyPassword(input.password, user.password_hash);
  if (!passwordMatches) {
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Checked after the password so status is not disclosed to unauthenticated callers.
  assertAccountActive(user);

  const tokens = await issueTokens(user, meta);

  return { user: toPublicUser(user), tokens };
}

/**
 * Rotate a refresh token (POST /api/v1/auth/refresh).
 *
 * The presented token is revoked and replaced. Presenting an already-revoked
 * token is treated as theft: every session for that user is revoked.
 *
 * @param {{refreshToken: string}} input
 * @param {{userAgent?: string|null, ipAddress?: string|null}} [meta]
 * @returns {Promise<{user: object, tokens: object}>}
 */
async function refresh(input, meta = {}) {
  const invalid = () => new UnauthorizedError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');

  let payload;
  try {
    payload = verifyRefreshToken(input.refreshToken);
  } catch (error) {
    throw invalid();
  }

  if (payload.type !== REFRESH_TOKEN_TYPE) {
    throw invalid();
  }

  const tokenHash = hashToken(input.refreshToken);
  const stored = await refreshTokenRepository.findByHash(tokenHash);

  if (!stored) {
    throw invalid();
  }

  if (stored.revoked_at) {
    // `replaced_by_hash` is only set when the token was rotated, so it is the
    // precise signal for "this token was already exchanged". Presenting it again
    // means the token leaked - assume compromise and kill the whole family.
    if (stored.replaced_by_hash) {
      await refreshTokenRepository.revokeAllForUser(stored.user_id);
      throw new UnauthorizedError(
        'Refresh token has already been used. All sessions were revoked; please sign in again.',
        'REFRESH_TOKEN_REUSED'
      );
    }

    // Revoked by logout (or an administrative action) - simply unusable.
    throw invalid();
  }

  if (new Date(stored.expires_at) <= new Date()) {
    throw invalid();
  }

  assertAccountActive({ status: stored.user_status });

  const user = {
    id: stored.user_id,
    name: stored.user_name,
    email: stored.user_email,
    role: stored.user_role,
    status: stored.user_status,
  };

  const tokens = await issueTokens(user, meta);
  // Record the rotation (also marks the presented token as spent).
  await refreshTokenRepository.revoke(stored.id, hashToken(tokens.refreshToken));

  // Opportunistic housekeeping so the table cannot grow unbounded.
  await refreshTokenRepository.deleteExpired();

  return { user: toPublicUser(user), tokens };
}

/**
 * Revoke a refresh token (POST /api/v1/auth/logout). Idempotent by design.
 *
 * @param {{refreshToken?: string|null}} input
 * @returns {Promise<void>}
 */
async function logout(input) {
  if (!input.refreshToken) {
    return;
  }

  let payload;
  try {
    payload = verifyRefreshToken(input.refreshToken);
  } catch (error) {
    // An expired or forged token is already unusable - nothing to revoke.
    return;
  }

  if (payload.type !== REFRESH_TOKEN_TYPE) {
    return;
  }

  const stored = await refreshTokenRepository.findByHash(hashToken(input.refreshToken));
  if (stored && !stored.revoked_at) {
    await refreshTokenRepository.revoke(stored.id);
  }
}

/**
 * Current user profile (GET /api/v1/auth/me).
 *
 * @param {number|string} userId
 * @returns {Promise<object>} public user
 */
async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new UnauthorizedError('Account no longer exists', 'ACCOUNT_NOT_FOUND');
  }
  return toPublicUser(user);
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  getProfile,
};
