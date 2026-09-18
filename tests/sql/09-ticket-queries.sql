-- =============================================================
-- Test Query File: Ticket Queries
-- Covers: docs/04-api-design.md §4.7 (Tickets)
--         docs/07-domain-tickets.md (Ticket Generation, QR Validation)
-- =============================================================

-- =============================================================
-- Q1: Generate ticket after successful payment
--    (docs/07 §7.1: After payment success, generate ticket number + QR code)
-- =============================================================
-- Generate tickets for a newly confirmed booking
INSERT INTO tickets (booking_id, ticket_number, qr_code, status, issued_at)
SELECT b.id,
       CONCAT('TKT-', LPAD(b.id, 8, '0')),
       CONCAT('qr://ticket/', UUID()),
       'ISSUED',
       NOW()
FROM bookings b
WHERE b.booking_reference = 'BK-BRW-HOLD-001'
  AND b.status = 'CONFIRMED'
  AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.booking_id = b.id);

-- Verify tickets were generated
SELECT t.id, t.booking_id, t.ticket_number, t.qr_code, t.status,
       DATE_FORMAT(t.issued_at, '%Y-%m-%d %H:%i:%s') AS issued_at
FROM tickets t
JOIN bookings b ON t.booking_id = b.id
WHERE b.booking_reference = 'BK-BRW-HOLD-001';

-- =============================================================
-- Q2: ATOMIC QR CODE VALIDATION (docs/07 §7.2)
--    ISSUED -> USED (atomic: prevents double entry)
--    Rows affected = 1 means success, 0 means already used/invalid
-- =============================================================
-- Get ticket by QR code and mark as USED atomically
-- (Bob's ticket for BK-RCK-00002 is ISSUED in the seed data; Alice's ticket
--  for BK-COM-00001 is already USED in the seed for the Q5 "already used" case.)
-- NOTE: joined to `bookings` instead of `WHERE id = (SELECT ... FROM tickets ...)`
-- because MySQL forbids selecting from the table being updated (ERROR 1093).
UPDATE tickets t
JOIN bookings b ON t.booking_id = b.id
SET t.status = 'USED',
    t.used_at = NOW()
WHERE b.booking_reference = 'BK-RCK-00002'
  AND t.status = 'ISSUED';
-- Rows affected = 1 → successfully validated and marked used
-- Rows affected = 0 → already used or not issued

-- Verify Bob's ticket (BK-RCK-00002) is now USED
SELECT t.id, t.ticket_number, t.status,
       DATE_FORMAT(t.issued_at, '%Y-%m-%d %H:%i:%s') AS issued_at,
       DATE_FORMAT(t.used_at, '%Y-%m-%d %H:%i:%s') AS used_at
FROM tickets t
JOIN bookings b ON t.booking_id = b.id
WHERE b.booking_reference = 'BK-RCK-00002';

-- Attempt to use the same ticket again (should affect 0 rows — prevents double entry)
UPDATE tickets t
JOIN bookings b ON t.booking_id = b.id
SET t.status = 'USED',
    t.used_at = NOW()
WHERE b.booking_reference = 'BK-RCK-00002'
  AND t.status = 'ISSUED';
-- Expected: 0 rows affected (ticket already USED)

-- =============================================================
-- Q3: Get ticket by QR code (POST /api/v1/tickets/validate)
--    Validates ticket before marking as used
-- =============================================================
SELECT t.id, t.ticket_number, t.status, t.issued_at, t.used_at,
       b.booking_reference,
       e.name AS event_name,
       s.start_time AS event_time,
       v.name AS venue_name,
       u.name AS user_name, u.email
FROM tickets t
JOIN bookings b ON t.booking_id = b.id
JOIN shows s ON b.show_id = s.id
JOIN events e ON s.event_id = e.id
JOIN venues v ON s.venue_id = v.id
JOIN users u ON b.user_id = u.id
WHERE t.qr_code = (
    SELECT qr_code FROM tickets
    WHERE booking_id = (SELECT id FROM bookings WHERE booking_reference = 'BK-RCK-00002')
    LIMIT 1
);

-- =============================================================
-- Q4: Get ticket details (GET /api/v1/tickets/{id})
-- =============================================================
SELECT t.id, t.ticket_number, t.qr_code, t.status,
       DATE_FORMAT(t.issued_at, '%Y-%m-%d %H:%i:%s') AS issued_at,
       DATE_FORMAT(t.used_at, '%Y-%m-%d %H:%i:%s') AS used_at,
       b.booking_reference, b.total_amount, b.currency,
       e.name AS event_name, s.start_time, v.name AS venue_name,
       u.name AS user_name, u.email
FROM tickets t
JOIN bookings b ON t.booking_id = b.id
JOIN shows s ON b.show_id = s.id
JOIN events e ON s.event_id = e.id
JOIN venues v ON s.venue_id = v.id
JOIN users u ON b.user_id = u.id
WHERE t.id = 1;

-- =============================================================
-- Q5: Validate ticket by ticket number (POST /api/v1/tickets/validate)
-- =============================================================
SELECT t.id, t.status, b.booking_reference,
       CASE
           WHEN t.status = 'ISSUED' THEN 'VALID - can be used'
           WHEN t.status = 'USED' THEN 'ALREADY USED'
           ELSE 'INVALID'
       END AS validation_result
FROM tickets t
JOIN bookings b ON t.booking_id = b.id
WHERE t.ticket_number = 'TKT-00000001';

-- =============================================================
-- Q6: List all tickets for a user (GET /api/v1/users/{id}/tickets)
-- =============================================================
SELECT t.id, t.ticket_number, t.status,
       DATE_FORMAT(t.issued_at, '%Y-%m-%d') AS issued_date,
       DATE_FORMAT(t.used_at, '%Y-%m-%d %H:%i:%s') AS used_at,
       e.name AS event_name,
       DATE_FORMAT(s.start_time, '%Y-%m-%d %H:00') AS show_time
FROM tickets t
JOIN bookings b ON t.booking_id = b.id
JOIN users u ON b.user_id = u.id
JOIN shows s ON b.show_id = s.id
JOIN events e ON s.event_id = e.id
WHERE u.id = 2
ORDER BY t.issued_at DESC;

-- =============================================================
-- Q7: Get ticket usage statistics (for admin / reporting)
-- =============================================================
SELECT t.status,
       COUNT(*) AS ticket_count,
       COUNT(CASE WHEN t.used_at IS NOT NULL THEN 1 END) AS used_count,
       MIN(t.issued_at) AS first_issued,
       MAX(t.issued_at) AS last_issued
FROM tickets t
GROUP BY t.status;