-- =============================================================
-- Test Query File: Booking Flow Queries
-- Covers: docs/04-api-design.md §4.5 (Booking)
--         docs/05-domain-booking.md §5.3-5.8 (Atomic Seat Reservation,
--         Seat Locking, Booking Flow, State Machine)
-- =============================================================

-- =============================================================
-- Q1: ATOMIC SEAT HOLD (docs/05 §5.3)
--    Atomically reserve a single seat: AVAILABLE -> HELD
--    Rows affected = 1 means success, 0 means seat was unavailable
-- =============================================================
-- NOTE: written as a multi-table UPDATE (instead of `WHERE id = (SELECT ... FROM
-- show_seats ...)`) because MySQL forbids selecting from the table being updated
-- in a subquery (ERROR 1093). The `ss.status = 'AVAILABLE'` guard keeps the
-- operation atomic: 1 row affected = held, 0 rows = seat was unavailable.
UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
SET ss.status = 'HELD',
    ss.hold_token = 'hold-token-abc123',
    ss.hold_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
WHERE ss.show_id = 4
  AND s.row_number = 'B'
  AND s.seat_number = '3'
  AND ss.status = 'AVAILABLE';

-- Check result (rows affected determines success)
-- SELECT ROW_COUNT() AS rows_affected; -- 1 = success, 0 = failed

-- Verify the seat is now HELD
SELECT ss.id, CONCAT(s.row_number, s.seat_number) AS seat_label, ss.status,
       ss.hold_token, ss.hold_expires_at
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 4 AND s.row_number = 'B' AND s.seat_number = '3';

-- =============================================================
-- Q2: Attempt to hold an already-HELD seat (should FAIL — 0 rows)
--    This demonstrates the guard condition prevents double-holding
-- =============================================================
UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
SET ss.status = 'HELD',
    ss.hold_token = 'hold-token-duplicate',
    ss.hold_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
WHERE ss.show_id = 4
  AND s.row_number = 'B'
  AND s.seat_number = '3'
  AND ss.status = 'AVAILABLE';
-- Expected: 0 rows affected (seat is already HELD)

-- =============================================================
-- Q3: Create a booking record (POST /api/v1/bookings/hold)
--    In the app this is done in a transaction with Q1-Q4
-- =============================================================
INSERT INTO bookings (user_id, show_id, booking_reference, idempotency_key,
    status, subtotal, discount, total_amount, currency, expires_at)
VALUES (2, 4, 'BK-BRW-HOLD-001', 'idem-key-booking-001',
        'PENDING', 75.00, 0.00, 75.00, 'INR',
        DATE_ADD(NOW(), INTERVAL 10 MINUTE));

-- Get the newly created booking ID
SELECT id, booking_reference, status, total_amount, expires_at
FROM bookings
WHERE booking_reference = 'BK-BRW-HOLD-001';

-- =============================================================
-- Q4: Add booking items for held seats
-- =============================================================
INSERT INTO booking_items (booking_id, show_seat_id, price)
SELECT (SELECT id FROM bookings WHERE booking_reference = 'BK-BRW-HOLD-001'),
       ss.id, ss.price
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 4
  AND s.row_number = 'B'
  AND s.seat_number = '3';

-- Link the show_seat to the booking
UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
SET ss.booking_id = (SELECT id FROM bookings WHERE booking_reference = 'BK-BRW-HOLD-001')
WHERE ss.show_id = 4 AND s.row_number = 'B' AND s.seat_number = '3';

-- =============================================================
-- Q5: Get booking details (GET /api/v1/bookings/{id})
-- =============================================================
SELECT b.id, b.booking_reference, b.status, b.subtotal, b.discount,
       b.total_amount, b.currency, b.expires_at,
       u.name AS user_name, u.email,
       e.name AS event_name, v.name AS venue_name,
       sh.start_time, sh.end_time,
       p.status AS payment_status, p.provider
FROM bookings b
JOIN users u ON b.user_id = u.id
JOIN shows sh ON b.show_id = sh.id
JOIN events e ON sh.event_id = e.id
JOIN venues v ON sh.venue_id = v.id
LEFT JOIN payments p ON p.booking_id = b.id
WHERE b.booking_reference = 'BK-BRW-HOLD-001';

-- =============================================================
-- Q6: Get booking items (seats selected for a booking)
-- =============================================================
SELECT bi.id AS item_id, bi.price,
       s.row_number, s.seat_number, s.seat_type,
       CONCAT(s.row_number, s.seat_number) AS seat_label,
       ss.status
FROM booking_items bi
JOIN show_seats ss ON bi.show_seat_id = ss.id
JOIN seats s ON ss.seat_id = s.id
WHERE bi.booking_id = (SELECT id FROM bookings WHERE booking_reference = 'BK-BRW-HOLD-001')
ORDER BY s.row_number, CAST(s.seat_number AS UNSIGNED);

-- =============================================================
-- Q7: CANCEL A BOOKING (POST /api/v1/bookings/{id}/cancel)
--    Release held/booked seats back to AVAILABLE
--    (docs/05 §5.8: PENDING -> CANCELLED)
-- =============================================================
-- A throwaway booking (seat B7) is used for the cancellation demo so that
-- BK-BRW-HOLD-001 stays alive for the payment (08) and ticket (09) steps.
INSERT INTO bookings (user_id, show_id, booking_reference, idempotency_key,
    status, subtotal, discount, total_amount, currency, expires_at)
VALUES (2, 4, 'BK-BRW-CANCEL-005', 'idem-key-cancel-005',
        'PENDING', 75.00, 0.00, 75.00, 'INR',
        DATE_ADD(NOW(), INTERVAL 10 MINUTE));

-- Hold seat B7 and attach it to the throwaway booking
UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
SET ss.status = 'HELD',
    ss.hold_token = 'hold-token-cancel-005',
    ss.hold_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
    ss.booking_id = (SELECT id FROM bookings WHERE booking_reference = 'BK-BRW-CANCEL-005')
WHERE ss.show_id = 4 AND s.row_number = 'B' AND s.seat_number = '7';

INSERT INTO booking_items (booking_id, show_seat_id, price)
SELECT (SELECT id FROM bookings WHERE booking_reference = 'BK-BRW-CANCEL-005'),
       ss.id, ss.price
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 4 AND s.row_number = 'B' AND s.seat_number = '7';

-- Cancel it
UPDATE bookings
SET status = 'CANCELLED',
    updated_at = NOW()
WHERE booking_reference = 'BK-BRW-CANCEL-005';

-- Release the held seat back to AVAILABLE
UPDATE show_seats ss
JOIN booking_items bi ON ss.id = bi.show_seat_id
JOIN bookings b ON bi.booking_id = b.id
SET ss.status = 'AVAILABLE',
    ss.hold_token = NULL,
    ss.hold_expires_at = NULL,
    ss.booking_id = NULL
WHERE b.booking_reference = 'BK-BRW-CANCEL-005';

-- Verify cancellation
SELECT b.booking_reference, b.status, ss.status AS seat_status, ss.hold_token
FROM bookings b
LEFT JOIN show_seats ss ON b.id = ss.booking_id
WHERE b.booking_reference = 'BK-BRW-CANCEL-005';

-- =============================================================
-- Q8: MULTI-SEAT RESERVATION WITH TRANSACTION (docs/05 §5.3)
--    Reserve multiple seats atomically using SELECT ... FOR UPDATE
--    (docs/03 §3.13: Use SELECT ... FOR UPDATE for multi-seat reservations)
-- =============================================================
START TRANSACTION;

-- Lock and check availability of seats B4, B5, B6 in show 4
SELECT ss.id, CONCAT(s.row_number, s.seat_number) AS seat_label, ss.price, ss.status
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 4
  AND s.row_number = 'B'
  AND s.seat_number IN ('4', '5', '6')
  AND ss.status = 'AVAILABLE'
FOR UPDATE;

-- If all seats are available (expected count = 3), hold them
UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
SET ss.status = 'HELD',
    ss.hold_token = 'multi-hold-token-xyz',
    ss.hold_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
WHERE ss.show_id = 4
  AND s.row_number = 'B'
  AND s.seat_number IN ('4', '5', '6')
  AND ss.status = 'AVAILABLE';

-- Create the booking
INSERT INTO bookings (user_id, show_id, booking_reference, idempotency_key,
    status, subtotal, discount, total_amount, currency, expires_at)
VALUES (3, 4, 'BK-BRW-MULTI-002', 'idem-key-multi-002',
        'PENDING', 225.00, 0.00, 225.00, 'INR',
        DATE_ADD(NOW(), INTERVAL 10 MINUTE));

-- Link seats to booking and create booking items
UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
SET ss.booking_id = (SELECT id FROM bookings WHERE booking_reference = 'BK-BRW-MULTI-002')
WHERE ss.show_id = 4
  AND s.row_number = 'B'
  AND s.seat_number IN ('4', '5', '6');

INSERT INTO booking_items (booking_id, show_seat_id, price)
SELECT (SELECT id FROM bookings WHERE booking_reference = 'BK-BRW-MULTI-002'),
       ss.id, ss.price
FROM show_seats ss
WHERE ss.show_id = 4
  AND ss.hold_token = 'multi-hold-token-xyz';

COMMIT;

-- Verify the multi-seat booking
SELECT b.booking_reference, b.status, b.total_amount,
       COUNT(bi.id) AS seats_booked
FROM bookings b
LEFT JOIN booking_items bi ON b.id = bi.booking_id
WHERE b.booking_reference = 'BK-BRW-MULTI-002'
GROUP BY b.id;

-- =============================================================
-- Q9: Booking State Machine transitions
--    (docs/05 §5.8: PENDING -> PAYMENT_PROCESSING -> CONFIRMED)
--    The CANCELLED transition is exercised in Q7 above.
-- =============================================================
-- Transition: PENDING -> PAYMENT_PROCESSING (user proceeds to payment)
UPDATE bookings
SET status = 'PAYMENT_PROCESSING',
    updated_at = NOW()
WHERE booking_reference = 'BK-BRW-HOLD-001'
  AND status = 'PENDING';

-- Verify state
SELECT booking_reference, status FROM bookings
WHERE booking_reference = 'BK-BRW-HOLD-001';
-- BK-BRW-HOLD-001 now waits for the payment webhook: 08-payment-queries.sql
-- completes PAYMENT_PROCESSING -> CONFIRMED and 09-ticket-queries.sql issues
-- the ticket for the confirmed booking.

-- =============================================================
-- Q10: Idempotency check for booking creation
--    (docs/06 §6.3: duplicate requests should return cached result)
-- =============================================================
-- Check if a booking already exists for an idempotency key
SELECT b.id, b.booking_reference, b.status, b.total_amount
FROM bookings b
WHERE idempotency_key = 'idem-key-multi-002';

-- Attempt to create a booking with a duplicate idempotency key (should fail)
-- This simulates the idempotency check in the application layer
INSERT INTO bookings (user_id, show_id, booking_reference, idempotency_key,
    status, subtotal, discount, total_amount, currency, expires_at)
VALUES (3, 4, 'BK-BRW-DUPLICATE', 'idem-key-multi-002',
        'PENDING', 225.00, 0.00, 225.00, 'INR',
        DATE_ADD(NOW(), INTERVAL 10 MINUTE))
ON DUPLICATE KEY UPDATE
    id = id;  -- No-op: idempotency key already exists, return existing booking

-- Retrieve the original booking (idempotent response)
SELECT b.id, b.booking_reference, b.status, b.total_amount
FROM bookings b
WHERE idempotency_key = 'idem-key-multi-002';

-- =============================================================
-- Q11: User's booking history with seat info
--    (GET booking history for a user)
-- =============================================================
SELECT b.id, b.booking_reference, b.status, b.total_amount, b.currency,
       e.name AS event_name,
       DATE_FORMAT(s.start_time, '%Y-%m-%d %H:00') AS show_time,
       v.name AS venue_name,
       GROUP_CONCAT(CONCAT(seat.row_number, seat.seat_number) ORDER BY seat.row_number, seat.seat_number) AS seats,
       p.status AS payment_status
FROM bookings b
JOIN users u ON b.user_id = u.id
JOIN shows s ON b.show_id = s.id
JOIN events e ON s.event_id = e.id
JOIN venues v ON s.venue_id = v.id
LEFT JOIN booking_items bi ON b.id = bi.booking_id
LEFT JOIN show_seats ss ON bi.show_seat_id = ss.id
LEFT JOIN seats seat ON ss.seat_id = seat.id
LEFT JOIN payments p ON p.booking_id = b.id
WHERE u.id = 2
GROUP BY b.id, b.booking_reference, b.status, b.total_amount, b.currency,
         e.name, s.start_time, v.name, p.status
ORDER BY b.created_at DESC;