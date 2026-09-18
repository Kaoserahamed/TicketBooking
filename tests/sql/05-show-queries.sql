-- =============================================================
-- Test Query File: Show / Schedule Queries
-- Covers: docs/04-api-design.md §4.3 (Shows)
--         docs/05-domain-booking.md §5.7 (Booking Flow)
-- =============================================================

-- =============================================================
-- Q1: List shows for an event (GET /api/v1/events/{id}/shows)
-- =============================================================
SELECT s.id AS show_id,
       s.start_time, s.end_time, s.status,
       e.name AS event_name,
       v.name AS venue_name, v.city, v.capacity
FROM shows s
JOIN events e ON s.event_id = e.id
JOIN venues v ON s.venue_id = v.id
WHERE s.event_id = 1
ORDER BY s.start_time;

-- =============================================================
-- Q2: Get show details by ID (detailed show info)
-- =============================================================
SELECT s.id AS show_id,
       s.event_id, e.name AS event_name, e.description, e.category, e.poster_url,
       s.venue_id, v.name AS venue_name, v.address, v.city, v.capacity,
       s.start_time, s.end_time, s.status,
       DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i:%s') AS scheduled_at
FROM shows s
JOIN events e ON s.event_id = e.id
JOIN venues v ON s.venue_id = v.id
WHERE s.id = 1;

-- =============================================================
-- Q3: List upcoming shows (SCHEDULED + start_time in the future)
-- =============================================================
SELECT s.id AS show_id, e.name AS event_name, v.name AS venue_name, v.city,
       DATE_FORMAT(s.start_time, '%Y-%m-%d %H:00') AS start_time,
       DATE_FORMAT(s.end_time, '%H:%i') AS end_time
FROM shows s
JOIN events e ON s.event_id = e.id
JOIN venues v ON s.venue_id = v.id
WHERE s.status = 'SCHEDULED'
  AND s.start_time > NOW()
ORDER BY s.start_time;

-- =============================================================
-- Q4: List shows by venue
-- =============================================================
SELECT s.id AS show_id, e.name AS event_name,
       DATE_FORMAT(s.start_time, '%Y-%m-%d %H:00') AS start_time,
       s.status
FROM shows s
JOIN events e ON s.event_id = e.id
JOIN venues v ON s.venue_id = v.id
WHERE v.id = 1
ORDER BY s.start_time;

-- =============================================================
-- Q5: Get show with seat availability summary
--    (for seat map display on frontend)
-- =============================================================
SELECT s.id AS show_id, e.name AS event_name, v.name AS venue_name,
       s.start_time,
       COUNT(ss.id) AS total_seats,
       COUNT(CASE WHEN ss.status = 'AVAILABLE' THEN 1 END) AS available,
       COUNT(CASE WHEN ss.status = 'HELD' THEN 1 END) AS held,
       COUNT(CASE WHEN ss.status = 'BOOKED' THEN 1 END) AS booked,
       COUNT(CASE WHEN ss.status = 'BLOCKED' THEN 1 END) AS blocked
FROM shows s
JOIN events e ON s.event_id = e.id
JOIN venues v ON s.venue_id = v.id
LEFT JOIN show_seats ss ON s.id = ss.show_id
WHERE s.id = 4
GROUP BY s.id, e.name, v.name, s.start_time;

-- =============================================================
-- Q6: List past shows that can be marked as COMPLETED
-- =============================================================
SELECT s.id, e.name, v.name AS venue_name,
       DATE_FORMAT(s.start_time, '%Y-%m-%d %H:00') AS start_time
FROM shows s
JOIN events e ON s.event_id = e.id
JOIN venues v ON s.venue_id = v.id
WHERE s.status = 'SCHEDULED'
  AND s.end_time < NOW()
  AND s.start_time > DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY s.start_time DESC;

-- =============================================================
-- Q7: Update show status (admin: schedule a show)
-- =============================================================
-- Mark a past show as COMPLETED
UPDATE shows SET status = 'COMPLETED'
WHERE id = 1 AND end_time < NOW();

-- Verify
SELECT s.id, e.name, s.start_time, s.end_time, s.status
FROM shows s JOIN events e ON s.event_id = e.id
WHERE s.id = 1;

-- =============================================================
-- Q8: Shows with no seat inventory yet (for admin setup)
-- =============================================================
SELECT s.id AS show_id, e.name AS event_name, v.name AS venue_name
FROM shows s
JOIN events e ON s.event_id = e.id
JOIN venues v ON s.venue_id = v.id
LEFT JOIN show_seats ss ON s.id = ss.show_id
WHERE ss.id IS NULL
ORDER BY s.start_time;

-- =============================================================
-- Q9: Count shows by event and status (admin dashboard)
-- =============================================================
SELECT e.name AS event_name, s.status, COUNT(*) AS show_count
FROM shows s
JOIN events e ON s.event_id = e.id
GROUP BY e.name, s.status
ORDER BY e.name, s.status;