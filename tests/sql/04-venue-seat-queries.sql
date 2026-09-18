-- =============================================================
-- Test Query File: Venue & Seat Queries
-- Covers: docs/04-api-design.md §4.4 (Seats)
--         docs/02-system-architecture.md §2.4 (venues, seats modules)
-- =============================================================

-- =============================================================
-- Q1: List all venues (GET /api/v1/venues or admin)
-- =============================================================
SELECT id, name, address, city, capacity,
       DATE_FORMAT(created_at, '%Y-%m-%d') AS created_date
FROM venues
ORDER BY city, name;

-- =============================================================
-- Q2: Get venue details with seat layout summary
-- =============================================================
SELECT v.id, v.name, v.address, v.city, v.capacity,
       COUNT(s.id) AS total_seats,
       COUNT(CASE WHEN s.seat_type = 'VIP' THEN 1 END) AS vip_seats,
       COUNT(CASE WHEN s.seat_type = 'PREMIUM' THEN 1 END) AS premium_seats,
       COUNT(CASE WHEN s.seat_type = 'REGULAR' THEN 1 END) AS regular_seats,
       COUNT(CASE WHEN s.seat_type = 'BALCONY' THEN 1 END) AS balcony_seats,
       COUNT(CASE WHEN s.seat_type = 'BOX' THEN 1 END) AS box_seats
FROM venues v
LEFT JOIN seats s ON v.id = s.venue_id
WHERE v.id = 1
GROUP BY v.id, v.name, v.address, v.city, v.capacity;

-- =============================================================
-- Q3: Get seat map for a venue (GET /api/v1/shows/{id}/seats)
-- =============================================================
SELECT s.id AS seat_id, s.row_number, s.seat_number, s.seat_type,
       CONCAT(s.row_number, s.seat_number) AS seat_label
FROM seats s
WHERE s.venue_id = 1
ORDER BY s.row_number, CAST(s.seat_number AS UNSIGNED);

-- =============================================================
-- Q4: Count seats by type for a venue
-- =============================================================
SELECT seat_type, COUNT(*) AS seat_count
FROM seats
WHERE venue_id = 1
GROUP BY seat_type
ORDER BY seat_count DESC;

-- =============================================================
-- Q5: Get venue capacity utilization (for admin)
-- =============================================================
SELECT v.name AS venue_name, v.city, v.capacity,
       COUNT(s.id) AS configured_seats,
       (v.capacity - COUNT(s.id)) AS unmapped_seats
FROM venues v
LEFT JOIN seats s ON v.id = s.venue_id
GROUP BY v.id, v.name, v.city, v.capacity
ORDER BY v.name;

-- =============================================================
-- Q6: Admin - Add a new seat to a venue (POST seat configuration)
-- =============================================================
INSERT INTO seats (venue_id, `row_number`, seat_number, seat_type)
VALUES (3, 'A', '11', 'VIP');

-- Verify the new seat
SELECT id, venue_id, `row_number`, seat_number, seat_type
FROM seats
WHERE venue_id = 3 AND `row_number` = 'A' AND seat_number = '11';

-- =============================================================
-- Q7: Admin - Update a seat type (PUT seat configuration)
-- =============================================================
UPDATE seats
SET seat_type = 'PREMIUM'
WHERE venue_id = 3 AND `row_number` = 'A' AND seat_number = '11';

-- Verify the update
SELECT id, `row_number`, seat_number, seat_type
FROM seats
WHERE venue_id = 3 AND `row_number` = 'A' AND seat_number = '11';

-- =============================================================
-- Q8: Admin - Delete a seat (DELETE seat configuration)
-- =============================================================
DELETE FROM seats
WHERE venue_id = 3 AND `row_number` = 'A' AND seat_number = '11';

-- Verify deletion
SELECT COUNT(*) AS remaining_seats_with_label_a11
FROM seats
WHERE venue_id = 3 AND `row_number` = 'A' AND seat_number = '11';

-- =============================================================
-- Q9: Find seats that are not yet assigned to any show
--    (for show_seats generation during show creation)
-- =============================================================
SELECT s.id AS seat_id, s.row_number, s.seat_number
FROM seats s
WHERE s.venue_id = 1
  AND s.id NOT IN (
      SELECT DISTINCT seat_id FROM show_seats WHERE show_id = 4
  )
ORDER BY s.row_number, CAST(s.seat_number AS UNSIGNED);

-- =============================================================
-- Q10: List all venues with their total shows
-- =============================================================
SELECT v.name, v.city, v.capacity,
       COUNT(s.id) AS total_shows,
       COUNT(CASE WHEN s.status = 'SCHEDULED' THEN 1 END) AS upcoming_shows
FROM venues v
LEFT JOIN shows s ON v.id = s.venue_id
GROUP BY v.id, v.name, v.city, v.capacity
ORDER BY total_shows DESC;
