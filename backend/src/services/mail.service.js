'use strict';

/**
 * Outbound email (docs/10-infrastructure-notifications.md).
 *
 * Two transports:
 *   * `smtp`    - real delivery through nodemailer (used when SMTP_HOST is set)
 *   * `console` - logs the message; the development default so the flows are
 *                 usable without an SMTP server
 *
 * Tests use `capture` mode via `setTransportOverride()` so assertions are
 * deterministic and no mail is sent.
 */

const config = require('../config/env');

/** @type {Array<{to: string, subject: string, text: string, sentAt: string}>} */
const outbox = [];

/** @type {'console'|'smtp'|'memory'|null} */
let transportOverride = null;

/**
 * Resolve the transport to use.
 *
 * @returns {'console'|'smtp'}
 */
function resolveTransport() {
  if (transportOverride === 'memory' || transportOverride === 'console' || transportOverride === 'smtp') {
    return transportOverride === 'memory' ? 'console' : transportOverride;
  }
  if (config.mail.transport === 'smtp' || config.mail.transport === 'console') {
    return config.mail.transport;
  }
  return config.mail.host ? 'smtp' : 'console';
}

/**
 * Force a transport (used by tests) or reset it with `null`.
 *
 * @param {'console'|'smtp'|'memory'|null} transport
 */
function setTransportOverride(transport) {
  transportOverride = transport;
  if (transport === 'memory') {
    outbox.length = 0;
  }
}

/**
 * Messages captured while the `memory` transport is active.
 *
 * @returns {Array<object>}
 */
function getOutbox() {
  return outbox.slice();
}

/** Clear the captured messages. */
function clearOutbox() {
  outbox.length = 0;
}

/**
 * Send an email.
 *
 * @param {{to: string, subject: string, text: string}} message
 * @returns {Promise<{transport: string, delivered: boolean}>}
 */
async function sendMail(message) {
  const transport = resolveTransport();
  const record = { ...message, sentAt: new Date().toISOString() };

  // Always keep a copy so tests and debugging can inspect what was "sent".
  outbox.push(record);

  if (transport === 'console') {
    console.log(
      `[mail:console] to=${message.to} subject="${message.subject}"\n${message.text}`
    );
    return { transport, delivered: false };
  }

  // Loaded lazily so the dependency is only required when SMTP is configured.
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password } : undefined,
  });

  await transporter.sendMail({
    from: config.mail.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });

  return { transport, delivered: true };
}

/**
 * Verification email body.
 *
 * @param {{name: string, email: string, token: string}} input
 */
function buildVerificationEmail({ name, email, token }) {
  const link = `${config.account.appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return {
    to: email,
    subject: 'Verify your Ticket Booking account',
    text: [
      `Hi ${name},`,
      '',
      'Confirm your email address to finish setting up your account:',
      link,
      '',
      `This link expires in ${Math.round(config.account.emailVerificationTtlMinutes / 60)} hour(s).`,
      'If you did not create this account you can ignore this message.',
    ].join('\n'),
  };
}

/**
 * Password reset email body.
 *
 * @param {{name: string, email: string, token: string}} input
 */
function buildPasswordResetEmail({ name, email, token }) {
  const link = `${config.account.appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    to: email,
    subject: 'Reset your Ticket Booking password',
    text: [
      `Hi ${name},`,
      '',
      'Use the link below to choose a new password:',
      link,
      '',
      `This link expires in ${config.account.passwordResetTtlMinutes} minute(s).`,
      'If you did not request this, no action is needed - your password is unchanged.',
    ].join('\n'),
  };
}

module.exports = {
  sendMail,
  buildVerificationEmail,
  buildPasswordResetEmail,
  setTransportOverride,
  getOutbox,
  clearOutbox,
  resolveTransport,
};