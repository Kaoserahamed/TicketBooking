-- =============================================================
-- Test Query File: Background Worker Queries
-- Covers: docs/05-domain-booking.md §5.6 (Seat Hold Expiration)
--         docs/05-domain-booking.md §5.8 (Booking State Machine)
--         docs/14-operations.md (Failure Scenarios)
-- =============================================================
-- These queries are run periodically by background workers:
--   - Hold cleanup worker (every 1-5 minutes)
--   - Booking expiration worker (every 5-10 minutes)
--   - Reconciliation worker (hourly/daily)

-- =============================================================
-- Q1: RELEASE EXPIRED SEAT HOLDS (docs/05 §5.6)
--    HELD -> AVAILABLE when hold_expires_at < NOW()
--    This is the core cleanup query from the documentation:
--    "UPDATE ... WHERE hold_expires_at < NOW() AND status = 'HELD'"
-- =============================================================
-- First, find how many holds are expired (for monitoring)
SELECT COUNT(*) AS expired_holds_count
FROM show_seats
WHERE status = 'HELD'
  AND hold_expires_at < NOW();

-- Release expired holds (set back to AVAILABLE, clear hold metadata)
UPDATE show_seats
SET status = 'AVAILABLE',
    hold_token = NULL,
    hold_expires_at = NULL
WHERE status = 'HELD'
  AND hold_expires_at < NOW();

SELECT ROW_COUNT() AS expired_holds_released;

-- Verify: no HELD seats with expired holds remain
SELECT COUNT(*) AS remaining_expired_holds
FROM show_seats
WHERE status = 'HELD'
  AND hold_expires_at < NOW();

-- =============================================================
-- Q2: Find EXPIRED BOOKINGS
--    Bookings in PENDING/PAYMENT_PROCESSING past their expires_at
--    (docs/05 §5.8: EXPIRED state)
-- =============================================================
SELECT b.id, b.booking_reference, b.status, b.total_amount,
       b.expires_at,
       TIMESTAMPDIFF(MINUTE, b.expires_at, NOW()) AS minutes_overdue,
       u.name AS user_name, u.email
FROM bookings b
JOIN users u ON b.user_id = u.id
WHERE b.status IN ('PENDING', 'PAYMENT_PROCESSING')
  AND b.expires_at IS NOT NULL
  AND b.expires_at < NOW()
ORDER BY b.expires_at;

-- =============================================================
-- Q3: EXPIRE BOOKINGS (set status to EXPIRED and release seats)
--    Must be done in a transaction to ensure consistency
-- =============================================================
START TRANSACTION;

-- Create a temporary table of bookings to expire
CREATE TEMPORARY TABLE expired_booking_ids AS
SELECT b.id AS booking_id
FROM bookings b
WHERE b.status IN ('PENDING', 'PAYMENT_PROCESSING')
  AND b.expires_at IS NOT NULL
  AND b.expires_at < NOW()
  AND NOT EXISTS (
      SELECT 1 FROM payments p
      WHERE p.booking_id = b.id
        AND p.status = 'SUCCESS'
  );

-- Mark bookings as EXPIRED
UPDATE bookings
SET status = 'EXPIRED',
    updated_at = NOW()
WHERE id IN (SELECT booking_id FROM expired_booking_ids);

-- Release the seats back to AVAILABLE
UPDATE show_seats
SET status = 'AVAILABLE',
    hold_token = NULL,
    hold_expires_at = NULL,
    booking_id = NULL
WHERE booking_id IN (SELECT booking_id FROM expired_booking_ids);

-- Count how many bookings were expired
SELECT ROW_COUNT() AS seats_released;

DROP TEMPORARY TABLE expired_booking_ids;

COMMIT;

-- =============================================================
-- Q4: Get hold expiration statistics (for monitoring dashboard)
-- =============================================================
SELECT
    COUNT(*) AS total_held_seats,
    COUNT(CASE WHEN hold_expires_at IS NOT NULL
               AND hold_expires_at > NOW() THEN 1 END) AS valid_holds,
    COUNT(CASE WHEN hold_expires_at IS NOT NULL
               AND hold_expires_at < NOW() THEN 1 END) AS expired_holds,
    COUNT(CASE WHEN hold_expires_at IS NULL THEN 1 END) AS invalid_holds,
    AVG(TIMESTAMPDIFF(MINUTE, NOW(), hold_expires_at)) AS avg_minutes_remaining
FROM show_seats
WHERE status = 'HELD';

-- =============================================================
-- Q5: Find UPCOMING EXPIRATIONS (proactive cleanup)
--    Seats that will expire within the next 2 minutes
-- =============================================================
SELECT ss.id, CONCAT(s.row_number, s.seat_number) AS seat_label,
       ss.hold_token, ss.hold_expires_at,
       TIMESTAMPDIFF(SECOND, NOW(), ss.hold_expires_at) AS seconds_remaining
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.status = 'HELD'
  AND ss.hold_expires_at IS NOT NULL
  AND ss.hold_expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 MINUTE)
  AND ss.hold_expires_at > NOW()
ORDER BY ss.hold_expires_at;

-- =============================================================
-- Q6: Find bookings that will expire soon (notify users)
--    Users with pending payments expiring within 5 minutes
-- =============================================================
SELECT b.id, b.booking_reference, b.total_amount,
       b.expires_at,
       TIMESTAMPDIFF(MINUTE, NOW(), b.expires_at) AS minutes_remaining,
       u.name AS user_name, u.email, u.phone
FROM bookings b
JOIN users u ON b.user_id = u.id
WHERE b.status IN ('PENDING', 'PAYMENT_PROCESSING')
  AND b.expires_at IS NOT NULL
  AND b.expires_at > NOW()
  AND b.expires_at <= DATE_ADD(NOW(), INTERVAL 5 MINUTE)
ORDER BY b.expires_at;