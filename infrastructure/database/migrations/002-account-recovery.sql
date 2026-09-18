-- =============================================================
-- Migration 002 - email verification & password reset
-- Adds:
--   * users.email_verified_at
--   * user_action_tokens (single-use tokens for both flows)
--
-- Idempotent: run it as many times as you like. The column is only added when
-- it is missing, and the table uses CREATE TABLE IF NOT EXISTS.
--
-- Usage:
--   mysql --defaults-extra-file=<cnf> ticket_booking < infrastructure/database/migrations/002-account-recovery.sql
-- =============================================================

-- 1. users.email_verified_at (added only when absent - MySQL has no
--    "ADD COLUMN IF NOT EXISTS", so the DDL is guarded via dynamic SQL).
SET @column_exists := (
    SELECT COUNT(*)
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name   = 'users'
       AND column_name  = 'email_verified_at'
);

SET @ddl := IF(
    @column_exists = 0,
    'ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL DEFAULT NULL AFTER status',
    'DO 0'
);

PREPARE alter_users FROM @ddl;
EXECUTE alter_users;
DEALLOCATE PREPARE alter_users;

-- 2. user_action_tokens
CREATE TABLE IF NOT EXISTS user_action_tokens (
    id              BIGINT      PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT      NOT NULL,
    purpose         ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET') NOT NULL,
    token_hash      CHAR(64)    NOT NULL,
    expires_at      DATETIME    NOT NULL,
    used_at         DATETIME    NULL DEFAULT NULL,
    created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_action_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    UNIQUE KEY uk_user_action_tokens_hash   (token_hash),
    INDEX idx_user_action_tokens_user       (user_id, purpose),
    INDEX idx_user_action_tokens_expires    (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
