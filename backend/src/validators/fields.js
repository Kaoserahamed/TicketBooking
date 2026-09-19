'use strict';

/**
 * Reusable field schemas.
 *
 * Single source of truth for the validation rules shared by the auth and user
 * validators (docs/11-security.md §11.2 - "Input validation (e.g. via Joi or
 * Zod)"). Zod strips unknown keys, so a client cannot smuggle extra fields.
 */

const { z } = require('zod');

/** Build the "X is required" message for a missing field. */
const required = (label) => ({ message: `${label} is required` });

const name = z
  .string(required('Name'))
  .min(2, 'Name must be at least 2 characters')
  .max(255, 'Name must be at most 255 characters');

const email = z
  .string(required('Email'))
  .email('A valid email address is required')
  .max(255, 'Email must be at most 255 characters');

const phone = z
  .string()
  .regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits, optionally prefixed with +');

// bcrypt only considers the first 72 bytes, so longer passwords are rejected
// rather than silently truncated.
const password = z
  .string(required('Password'))
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/** Opaque single-use tokens (base64url, 43 chars). */
const opaqueToken = z
  .string(required('Token'))
  .min(10, 'Token is not valid')
  .max(255, 'Token is not valid');

module.exports = { required, name, email, phone, password, opaqueToken };
