'use strict';

/**
 * Request schemas (docs/11-security.md §11.2 - "Input validation (e.g. via Joi
 * or Zod)"). Validation happens at the edge, before a controller runs.
 *
 * Note: Zod strips unknown keys by default, so a client cannot smuggle extra
 * fields (e.g. `role` or `status`) into the service layer.
 */

const { z } = require('zod');
const fields = require('./fields');

/** POST /api/v1/auth/register */
const registerSchema = z.object({
  name: fields.name,
  email: fields.email,
  phone: fields.phone.optional(),
  password: fields.password,
});

/** POST /api/v1/auth/login - password length is not re-checked here. */
const loginSchema = z.object({
  email: fields.email,
  password: z
    .string(fields.required('Password'))
    .min(1, 'Password is required')
    .max(255, 'Password is too long'),
});

/**
 * POST /api/v1/auth/refresh and /logout.
 *
 * The refresh token may arrive in the body or in the httpOnly cookie, so the
 * body is optional here and the controller resolves the final value.
 */
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken must not be empty').optional(),
});

/** POST /api/v1/auth/verify-email */
const verifyEmailSchema = z.object({
  token: fields.opaqueToken,
});

/** POST /api/v1/auth/forgot-password */
const forgotPasswordSchema = z.object({
  email: fields.email,
});

/** POST /api/v1/auth/reset-password */
const resetPasswordSchema = z.object({
  token: fields.opaqueToken,
  newPassword: fields.password,
});

const ROLES = ['USER', 'ADMIN', 'EVENT_MANAGER', 'VENUE_MANAGER', 'SUPPORT'];
const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'];

/** GET /api/v1/admin/users */
const listUsersQuerySchema = z.object({
  role: z.enum(ROLES, { message: `role must be one of: ${ROLES.join(', ')}` }).optional(),
  status: z.enum(STATUSES, { message: `status must be one of: ${STATUSES.join(', ')}` }).optional(),
  limit: z.coerce
    .number({ message: 'limit must be a number' })
    .int('limit must be an integer')
    .min(1, 'limit must be at least 1')
    .max(100, 'limit must be at most 100')
    .optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  listUsersQuerySchema,
  ROLES,
  STATUSES,
};