-- =============================================================
-- Ticket Booking System - Database Schema
-- MySQL 8+ | InnoDB Engine
-- Based on documentation in docs/03-database-design.md
-- =============================================================

-- =============================================================
-- 1. users  (Authentication & Authorization - docs/11-security.md)
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
    id              BIGINT      PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(255)  NOT NULL,
    email           VARCHAR(255)  NOT NULL UNIQUE,
    phone           VARCHAR(50)   NULL UNIQUE,
    password_hash   VARCHAR(255)  NOT NULL,
    role            ENUM('USER', 'ADMIN', 'EVENT_MANAGER', 'VENUE_MANAGER', 'SUPPORT')
                     DEFAULT 'USER',
    status          ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED')
                     DEFAULT 'ACTIVE',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_users_email (email),
    INDEX idx_users_phone (phone),
    INDEX idx_users_role  (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 2. venues  (Venue configuration)
-- =============================================================
CREATE TABLE IF NOT EXISTS venues (
    id              BIGINT      PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(255)  NOT NULL,
    address         TEXT,
    city            VARCHAR(100)  NOT NULL,
        capacity        INT           NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_venues_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 3. seats  (Seat layout - belongs to a venue)
-- =============================================================
CREATE TABLE IF NOT EXISTS seats (
    id              BIGINT      PRIMARY KEY AUTO_INCREMENT,
    venue_id        BIGINT      NOT NULL,
        `row_number`      VARCHAR(10) NOT NULL,
    seat_number     VARCHAR(10) NOT NULL,
    seat_type       ENUM('REGULAR', 'VIP', 'PREMIUM', 'BALCONY', 'BOX')
                     DEFAULT 'REGULAR',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_seats_venue
        FOREIGN KEY (venue_id)
        REFERENCES venues(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

        UNIQUE KEY uk_seats_venue_row_seat (venue_id, `row_number`, seat_number),
    INDEX idx_seats_venue (venue_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 4. events  (Event management)
-- =============================================================
CREATE TABLE IF NOT EXISTS events (
    id              BIGINT      PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(255)  NOT NULL,
    description     TEXT,
    category        VARCHAR(100),
    poster_url      VARCHAR(500),
    status          ENUM('DRAFT', 'PUBLISHED', 'ACTIVE', 'INACTIVE', 'CANCELLED')
                     DEFAULT 'DRAFT',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_events_category (category),
    INDEX idx_events_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 5. shows  (Event schedules - shows/schedules)
-- =============================================================
CREATE TABLE IF NOT EXISTS shows (
    id              BIGINT      PRIMARY KEY AUTO_INCREMENT,
    event_id        BIGINT      NOT NULL,
    venue_id        BIGINT      NOT NULL,
    start_time      DATETIME    NOT NULL,
    end_time        DATETIME    NOT NULL,
    status          ENUM('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED')
                     DEFAULT 'SCHEDULED',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_shows_event
        FOREIGN KEY (event_id)
        REFERENCES events(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_shows_venue
        FOREIGN KEY (venue_id)
        REFERENCES venues(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    UNIQUE KEY uk_shows_event_time (event_id, start_time),
    INDEX idx_shows_event  (event_id),
    INDEX idx_shows_venue  (venue_id),
        INDEX idx_shows_status (status),
    INDEX idx_shows_start  (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 6. bookings  (Booking header - one booking per show+user)
-- =============================================================
CREATE TABLE IF NOT EXISTS bookings (
    id              BIGINT      PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT      NOT NULL,
    show_id         BIGINT      NOT NULL,
    booking_reference VARCHAR(100) NOT NULL UNIQUE,
    idempotency_key VARCHAR(255) NULL UNIQUE,
    status          ENUM('PENDING', 'PAYMENT_PROCESSING', 'CONFIRMED',
                         'CANCELLED', 'EXPIRED', 'REFUNDED')
                     DEFAULT 'PENDING',
    subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency        VARCHAR(10)   NOT NULL DEFAULT 'INR',
    expires_at      DATETIME      NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_bookings_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_bookings_show
        FOREIGN KEY (show_id)
        REFERENCES shows(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_bookings_user      (user_id),
    INDEX idx_bookings_show      (show_id),
    INDEX idx_bookings_status    (status),
    INDEX idx_bookings_ref       (booking_reference),
    INDEX idx_bookings_idem_key  (idempotency_key),
    INDEX idx_bookings_expires   (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 7. show_seats  (Critical Inventory Table)
-- =============================================================
CREATE TABLE IF NOT EXISTS show_seats (
    id              BIGINT      PRIMARY KEY AUTO_INCREMENT,
    show_id         BIGINT      NOT NULL,
    seat_id         BIGINT      NOT NULL,
    price           DECIMAL(12,2) NOT NULL,
    status          ENUM('AVAILABLE', 'HELD', 'BOOKED', 'BLOCKED')
                     DEFAULT 'AVAILABLE',
    hold_token      VARCHAR(255)  NULL,
    hold_expires_at DATETIME      NULL,
    booking_id      BIGINT        NULL,
    version         INT           NOT NULL DEFAULT 0,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_show_seats_show
        FOREIGN KEY (show_id)
        REFERENCES shows(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_show_seats_seat
        FOREIGN KEY (seat_id)
        REFERENCES seats(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_show_seats_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    UNIQUE KEY uk_show_seats_show_seat (show_id, seat_id),
    INDEX idx_show_seats_show     (show_id),
    INDEX idx_show_seats_seat     (seat_id),
    INDEX idx_show_seats_status   (status),
    INDEX idx_show_seats_hold     (hold_expires_at),
        INDEX idx_show_seats_booking  (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 8. booking_items  (Line items linking booking to show seats)
-- =============================================================
CREATE TABLE IF NOT EXISTS booking_items (
    id              BIGINT      PRIMARY KEY AUTO_INCREMENT,
    booking_id      BIGINT      NOT NULL,
    show_seat_id    BIGINT      NOT NULL,
    price           DECIMAL(12,2) NOT NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_booking_items_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_booking_items_show_seat
        FOREIGN KEY (show_seat_id)
        REFERENCES show_seats(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_booking_items_booking     (booking_id),
    INDEX idx_booking_items_show_seat   (show_seat_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 9. payments  (Payment processing)
-- =============================================================
CREATE TABLE IF NOT EXISTS payments (
    id                  BIGINT      PRIMARY KEY AUTO_INCREMENT,
    booking_id          BIGINT      NOT NULL,
    provider            VARCHAR(50)   NOT NULL,
    provider_transaction_id VARCHAR(255) NOT NULL,
    amount              DECIMAL(12,2) NOT NULL,
    currency            VARCHAR(10)   NOT NULL DEFAULT 'INR',
    status              ENUM('INITIATED', 'PROCESSING', 'SUCCESS',
                             'FAILED', 'REFUNDED')
                         DEFAULT 'INITIATED',
    payment_method      VARCHAR(50),
    created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_payments_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    UNIQUE KEY uk_payments_provider_txn (provider_transaction_id),
    INDEX idx_payments_booking       (booking_id),
    INDEX idx_payments_status        (status),
    INDEX idx_payments_created       (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 10. tickets  (Generated after payment success)
-- =============================================================
CREATE TABLE IF NOT EXISTS tickets (
    id              BIGINT      PRIMARY KEY AUTO_INCREMENT,
    booking_id      BIGINT      NOT NULL,
    ticket_number   VARCHAR(100) NOT NULL UNIQUE,
    qr_code         VARCHAR(500),
    status          ENUM('ISSUED', 'USED') DEFAULT 'ISSUED',
    issued_at       DATETIME,
    used_at         DATETIME      NULL,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_tickets_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    INDEX idx_tickets_booking       (booking_id),
    INDEX idx_tickets_number        (ticket_number),
    INDEX idx_tickets_status        (status),
    INDEX idx_tickets_qr_code       (qr_code(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- NOTES (from docs/03-database-design.md §3.13)
-- =============================================================
-- 1. Use InnoDB engine for transaction support and row-level locking.
-- 2. Use atomic UPDATE ... WHERE status = 'AVAILABLE' to prevent double booking.
-- 3. Apply SELECT ... FOR UPDATE locking for multi-seat reservations within transactions.
-- 4. ON DELETE RESTRICT or ON DELETE CASCADE applied per-table as appropriate.
-- 5. UNIQUE constraint on show_seats(show_id, seat_id) prevents duplicate seat representation.
-- =============================================================