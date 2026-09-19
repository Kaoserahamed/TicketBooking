'use strict';

/**
 * Request schemas for the users module (docs/02-system-architecture.md §2.4 -
 * "users (profile management)").
 */

const { z } = require('zod');
const fields = require('./fields');

/**
 * PUT /api/v1/users/me
 *
 * Every field is optional (partial update) but at least one must be present -
 * a PATCH-style request with an empty body is a client mistake, not a no-op.
 * `phone` accepts null so a user can remove their number.
 */
const updateProfileSchema = z
  .object({
    name: fields.name.optional(),
    email: fields.email.optional(),
    phone: fields.phone.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update (name, email or phone)',
  });

/** PUT /api/v1/users/me/password */
const changePasswordSchema = z.object({
  currentPassword: z
    .string(fields.required('currentPassword'))
    .min(1, 'currentPassword is required')
    .max(255, 'currentPassword is too long'),
  newPassword: fields.password,
});

module.exports = { updateProfileSchema, changePasswordSchema };
