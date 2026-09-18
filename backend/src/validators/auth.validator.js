'use strict';

/**
 * Request schemas (docs/11-security.md §11.2 - "Input validation (e.g. via Joi
 * or Zod)"). Validation happens at the edge, before a controller runs.
 *
 * Note: Zod strips unknown keys by default, so a client cannot smuggle extra
 * fields (e.g. `role` or `status`) into the service layer.
 */

const { z } = require('zod');

// bcrypt only considers the first 72 bytes, so longer passwords are rejected
// rather than silently truncated.
const password = z
  .string({ message: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const email = z
  .string({ message: 'Email is required' })
  .email('A valid email address is required')
  .max(255, 'Email must be at most 255 characters');

const phone = z
  .string()
  .regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits, optionally prefixed with +')
  .optional();

const name = z
  .string({ message: 'Name is required' })
  .min(2, 'Name must be at least 2 characters')
  .max(255, 'Name must be at most 255 characters');

/** POST /api/v1/auth/register */
const registerSchema = z.object({
  name,
  email,
  phone,
  password,
});

/** POST /api/v1/auth/login */
const loginSchema = z.object({
  email,
  password: z.string({ message: 'Password is required' }).min(1, 'Password is required'),
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
  listUsersQuerySchema,
  ROLES,
  STATUSES,
};