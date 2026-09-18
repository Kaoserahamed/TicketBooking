-- =============================================================
-- Test Query File: Concurrency / Double-Booking Prevention
-- Covers: docs/05-domain-booking.md §5.3 (Atomic Seat Reservation)
--         docs/05-domain-booking.md §5.4 (Row-Level Lock: SELECT ... FOR UPDATE)
--         docs/03-database-design.md §3.13 (MySQL-specific considerations)
-- =============================================================

-- =============================================================
-- SCENARIO 1: Atomic Seat Hold (docs/05 §5.3)
--    Two simultaneous requests for the SAME seat.
--    The atomic UPDATE WHERE status = 'AVAILABLE' ensures only ONE succeeds.
-- =============================================================

-- -----------------------------------------------------------
-- SIMULATION: Attempt 1 - User A tries to hold seat B8 in show 4
-- (Seat B8 is not used by the booking flow in 07/08, so this scenario
--  cannot corrupt a confirmed booking's inventory.)
-- -----------------------------------------------------------
UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
SET ss.status = 'HELD',
    ss.hold_token = 'hold-userA-b8',
    ss.hold_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
WHERE ss.show_id = 4
  AND s.row_number = 'B'
  AND s.seat_number = '8'
  AND ss.status = 'AVAILABLE';
-- >>> Rows affected = 1 -> SUCCESS (User A got the seat)

-- Verify User A got the seat
SELECT ss.id AS show_seat_id, CONCAT(s.row_number, s.seat_number) AS seat_label,
       ss.status, ss.hold_token, ss.hold_expires_at
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 4 AND s.row_number = 'B' AND s.seat_number = '8';

-- -----------------------------------------------------------
-- SIMULATION: Attempt 2 - User B tries to hold the SAME seat
--    (Seat B8 is now HELD, so status = 'AVAILABLE' won't match)
-- -----------------------------------------------------------
UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
SET ss.status = 'HELD',
    ss.hold_token = 'hold-userB-b8',
    ss.hold_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
WHERE ss.show_id = 4
  AND s.row_number = 'B'
  AND s.seat_number = '8'
  AND ss.status = 'AVAILABLE';
-- >>> Rows affected = 0 -> FAILURE (seat already HELD by User A)

-- Verify the seat is still held by User A (not User B)
SELECT ss.id AS show_seat_id, CONCAT(s.row_number, s.seat_number) AS seat_label,
       ss.status, ss.hold_token
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 4 AND s.row_number = 'B' AND s.seat_number = '8';

-- Clean up: release only the hold created by this scenario (token guard)
UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
SET ss.status = 'AVAILABLE', ss.hold_token = NULL, ss.hold_expires_at = NULL
WHERE ss.show_id = 4 AND s.row_number = 'B' AND s.seat_number = '8'
  AND ss.hold_token = 'hold-userA-b8';

-- =============================================================
-- SCENARIO 2: Multi-Seat Reservation with SELECT ... FOR UPDATE
--    (docs/05 §5.4: Row-level locking prevents race conditions)
-- =============================================================
START TRANSACTION;

-- User A locks seats A1, A2, A3 for show 4
SELECT ss.id, CONCAT(s.row_number, s.seat_number) AS seat_label, ss.status
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 4
  AND s.row_number = 'A'
  AND s.seat_number IN ('1', '2', '3')
  AND ss.status = 'AVAILABLE'
FOR UPDATE;

-- Atomically hold all 3 seats
UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
SET ss.status = 'HELD',
    ss.hold_token = 'multi-hold-userA-a123',
    ss.hold_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
WHERE ss.show_id = 4
  AND s.row_number = 'A'
  AND s.seat_number IN ('1', '2', '3')
  AND ss.status = 'AVAILABLE';

SELECT ROW_COUNT() AS seats_held;
-- Expected: 3 (all seats were available and held)

COMMIT;

-- -----------------------------------------------------------
-- Concurrent attempt: User B tries to hold A1, A2, A3 (same seats)
-- After User A's transaction committed, these are now HELD
-- -----------------------------------------------------------
START TRANSACTION;

SELECT ss.id, CONCAT(s.row_number, s.seat_number) AS seat_label, ss.status
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 4
  AND s.row_number = 'A'
  AND s.seat_number IN ('1', '2', '3')
  AND ss.status = 'AVAILABLE'
FOR UPDATE;
-- Expected: 0 rows (all seats are HELD by User A)

SELECT ROW_COUNT() AS available_seats_found;
-- Expected: 0

-- Since 0 seats available, do NOT hold any -> rollback
ROLLBACK;

-- Clean up: release User A's seats
UPDATE show_seats
SET status = 'AVAILABLE', hold_token = NULL, hold_expires_at = NULL
WHERE hold_token = 'multi-hold-userA-a123';

-- =============================================================
-- SCENARIO 3: Optimistic Locking with Version Field
--    (docs/03 §3.7: show_seats has a `version` field)
--    CAS pattern: only update if version matches (prevents lost updates)
-- =============================================================

-- Read the current state (autocommit SELECT — no lock taken)
-- NOTE: `row_number` must be quoted (reserved word in MySQL 8+) and the CAS value
-- is read into session variables because MySQL rejects a subquery on the table
-- being updated (ERROR 1093).
SET @target_show_seat_id = (
    SELECT ss.id FROM show_seats ss
    JOIN seats s ON ss.seat_id = s.id
    WHERE ss.show_id = 4 AND s.row_number = 'A' AND s.seat_number = '5'
    LIMIT 1
);
SET @expected_version = (SELECT version FROM show_seats WHERE id = @target_show_seat_id);

-- Atomically update with version check (Compare-And-Set)
UPDATE show_seats
SET status = 'HELD',
    hold_token = 'optimistic-hold-test',
    hold_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
    version = version + 1
WHERE id = @target_show_seat_id
  AND status = 'AVAILABLE'
  AND version = @expected_version;
-- Rows affected = 1 -> success, version was incremented
-- Rows affected = 0 -> concurrent update detected

-- Verify the version was incremented
SELECT ss.id, CONCAT(s.row_number, s.seat_number) AS seat_label,
       ss.status, ss.hold_token, ss.version
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 4 AND s.row_number = 'A' AND s.seat_number = '5';

-- Clean up
UPDATE show_seats
SET status = 'AVAILABLE', hold_token = NULL, hold_expires_at = NULL
WHERE hold_token = 'optimistic-hold-test';

-- =============================================================
-- SCENARIO 4: Idempotent Seat Conversion (BOOKED verification)
--    Prevent double-booking: only BOOKED seats can generate tickets
-- =============================================================
SELECT ss.id, ss.status, ss.booking_id
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
JOIN shows sh ON ss.show_id = sh.id
JOIN events e ON sh.event_id = e.id
WHERE e.name = 'Broadway: The Phantom'
  AND s.row_number = 'C'
  AND s.seat_number = '5'
  AND ss.status = 'BOOKED';
-- Returns a row only if the seat is actually BOOKED