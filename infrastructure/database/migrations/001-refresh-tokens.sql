-- =============================================================
-- Migration 001 - refresh_tokens
-- Adds the refresh-token rotation store required by
-- docs/11-security.md §11.2 ("Refresh-token rotation").
--
-- Safe to run repeatedly: the table is only created when absent, so existing
-- databases can be upgraded without the destructive -Fresh reset.
--
-- Usage:
--   mysql --defaults-extra-file=<cnf> ticket_booking < infrastructure/database/migrations/001-refresh-tokens.sql
-- =============================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              BIGINT      PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT      NOT NULL,
    token_hash      CHAR(64)    NOT NULL,
    expires_at      DATETIME    NOT NULL,
    revoked_at      DATETIME    NULL DEFAULT NULL,
    replaced_by_hash CHAR(64)   NULL DEFAULT NULL,
    user_agent      VARCHAR(255) NULL,
    ip_address      VARCHAR(45)  NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    UNIQUE KEY uk_refresh_tokens_hash (token_hash),
    INDEX idx_refresh_tokens_user    (user_id),
    INDEX idx_refresh_tokens_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
