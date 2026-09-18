-- =============================================================
-- Test Query File: Seat Availability Queries
-- Covers: docs/04-api-design.md §4.4 (Seats/availability)
--         docs/05-domain-booking.md §5.2-5.6 (Seat Locking, Hold, Availability)
-- =============================================================

-- =============================================================
-- Q1: Get full seat map for a show with availability status
--    (GET /api/v1/shows/{id}/seats)
-- =============================================================
SELECT ss.id AS show_seat_id,
       s.row_number, s.seat_number,
       CONCAT(s.row_number, s.seat_number) AS seat_label,
       s.seat_type,
       ss.price,
       ss.status,
       ss.hold_expires_at
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 4
ORDER BY s.row_number, CAST(s.seat_number AS UNSIGNED);

-- =============================================================
-- Q2: Get real-time seat availability summary (GET /api/v1/shows/{id}/availability)
-- =============================================================
SELECT s.row_number,
       COUNT(*) AS total_seats,
       COUNT(CASE WHEN ss.status = 'AVAILABLE' THEN 1 END) AS available,
       COUNT(CASE WHEN ss.status = 'HELD' THEN 1 END) AS held,
       COUNT(CASE WHEN ss.status = 'BOOKED' THEN 1 END) AS booked,
       COUNT(CASE WHEN ss.status = 'BLOCKED' THEN 1 END) AS blocked
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 4
GROUP BY s.row_number
ORDER BY s.row_number;

-- =============================================================
-- Q3: Check if specific seats are available (for booking)
--    Returns only seats that are AVAILABLE
-- =============================================================
SELECT ss.id AS show_seat_id,
       CONCAT(s.row_number, s.seat_number) AS seat_label,
       ss.price
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 4
  AND s.row_number = 'B'
  AND s.seat_number IN ('3', '4', '5')
  AND ss.status = 'AVAILABLE';

-- =============================================================
-- Q4: Get available seats by type and price range
-- =============================================================
SELECT ss.id AS show_seat_id,
       CONCAT(s.row_number, s.seat_number) AS seat_label,
       s.seat_type,
       ss.price
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 1
  AND ss.status = 'AVAILABLE'
  AND s.seat_type = 'VIP'
ORDER BY ss.price ASC, s.row_number, CAST(s.seat_number AS UNSIGNED);

-- =============================================================
-- Q5: Find seats already held but not yet booked (for hold cleanup visibility)
-- =============================================================
SELECT ss.id AS show_seat_id,
       CONCAT(s.row_number, s.seat_number) AS seat_label,
       ss.hold_token,
       ss.hold_expires_at,
       TIMESTAMPDIFF(MINUTE, NOW(), ss.hold_expires_at) AS minutes_remaining
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 7
  AND ss.status = 'HELD'
  AND ss.hold_expires_at IS NOT NULL;

-- =============================================================
-- Q6: Get the cheapest available seats for a show
-- =============================================================
SELECT ss.id AS show_seat_id,
       CONCAT(s.row_number, s.seat_number) AS seat_label,
       s.seat_type,
       ss.price
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 1
  AND ss.status = 'AVAILABLE'
ORDER BY ss.price ASC
LIMIT 5;

-- =============================================================
-- Q7: Get the most expensive available seats (VIP sections)
-- =============================================================
SELECT ss.id AS show_seat_id,
       CONCAT(s.row_number, s.seat_number) AS seat_label,
       s.seat_type,
       ss.price
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 1
  AND ss.status = 'AVAILABLE'
  AND s.seat_type IN ('VIP', 'BOX')
ORDER BY ss.price DESC;

-- =============================================================
-- Q8: Get seat details by show_seat_id (for detailed seat view)
-- =============================================================
SELECT ss.id AS show_seat_id,
       s.id AS seat_id, s.row_number, s.seat_number, s.seat_type,
       ss.price, ss.status,
       ss.hold_token, ss.hold_expires_at,
       ss.booking_id, ss.version,
       v.name AS venue_name, v.city,
       e.name AS event_name,
       sh.start_time
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
JOIN venues v ON s.venue_id = v.id
JOIN shows sh ON ss.show_id = sh.id
JOIN events e ON sh.event_id = e.id
WHERE ss.id = 1;

-- =============================================================
-- Q9: Count total available seats per show (for all active shows)
-- =============================================================
SELECT sh.id AS show_id, e.name AS event_name, v.city,
       COUNT(*) AS total_seats,
       COUNT(CASE WHEN ss.status = 'AVAILABLE' THEN 1 END) AS available_seats
FROM show_seats ss
JOIN shows sh ON ss.show_id = sh.id
JOIN events e ON sh.event_id = e.id
JOIN venues v ON sh.venue_id = v.id
WHERE sh.status = 'SCHEDULED'
  AND sh.start_time > NOW()
GROUP BY sh.id, e.name, v.city
ORDER BY available_seats ASC
LIMIT 10;