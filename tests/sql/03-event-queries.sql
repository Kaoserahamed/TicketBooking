-- =============================================================
-- Test Query File: Event Queries
-- Covers: docs/04-api-design.md §4.3 (Events)
--         docs/02-system-architecture.md §2.4 (events module)
-- =============================================================

-- =============================================================
-- Q1: List all published events (GET /api/v1/events)
-- =============================================================
SELECT id, name, description, category, poster_url, status,
       DATE_FORMAT(created_at, '%Y-%m-%d') AS published_date
FROM events
WHERE status IN ('PUBLISHED', 'ACTIVE')
ORDER BY created_at DESC;

-- =============================================================
-- Q2: List events with pagination
-- =============================================================
SELECT id, name, category, status, poster_url
FROM events
WHERE status IN ('PUBLISHED', 'ACTIVE')
ORDER BY id
LIMIT 5 OFFSET 0;

-- =============================================================
-- Q3: Get event details by ID (GET /api/v1/events/{id})
-- =============================================================
SELECT id, name, description, category, poster_url, status,
       DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
       DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
FROM events
WHERE id = 1;

-- =============================================================
-- Q4: Get shows for an event (GET /api/v1/events/{id}/shows)
-- =============================================================
SELECT s.id AS show_id,
       e.name AS event_name,
       v.name AS venue_name, v.city,
       DATE_FORMAT(s.start_time, '%Y-%m-%d %H:00') AS start_time,
       DATE_FORMAT(s.end_time, '%H:%i') AS end_time,
       s.status
FROM shows s
JOIN events e ON s.event_id = e.id
JOIN venues v ON s.venue_id = v.id
WHERE s.event_id = 1
ORDER BY s.start_time;

-- =============================================================
-- Q5: Filter events by category (GET /api/v1/events?category=Music)
-- =============================================================
SELECT id, name, description, poster_url
FROM events
WHERE category = 'Music' AND status IN ('PUBLISHED', 'ACTIVE')
ORDER BY name;

-- =============================================================
-- Q6: Search events by keyword (GET /api/v1/events?search=rock)
-- =============================================================
SELECT id, name, category, poster_url
FROM events
WHERE (name LIKE '%Rock%' OR description LIKE '%Rock%')
  AND status IN ('PUBLISHED', 'ACTIVE');

-- =============================================================
-- Q7: Get published events with upcoming shows
-- =============================================================
SELECT DISTINCT e.id, e.name, e.category, e.poster_url,
       MIN(s.start_time) AS earliest_show,
       MAX(s.start_time) AS latest_show,
       COUNT(s.id) AS total_shows
FROM events e
JOIN shows s ON e.id = s.event_id
WHERE e.status IN ('PUBLISHED', 'ACTIVE')
  AND s.status = 'SCHEDULED'
  AND s.start_time > NOW()
GROUP BY e.id, e.name, e.category, e.poster_url
ORDER BY MIN(s.start_time);

-- =============================================================
-- Q8: Count shows per event (for event detail page)
-- =============================================================
SELECT e.id, e.name, COUNT(s.id) AS total_shows,
       COUNT(CASE WHEN s.status = 'SCHEDULED' THEN 1 END) AS upcoming_shows
FROM events e
LEFT JOIN shows s ON e.id = s.event_id
GROUP BY e.id, e.name
ORDER BY total_shows DESC;

-- =============================================================
-- Q9: List events with total bookings and revenue
-- =============================================================
SELECT e.id, e.name, e.category,
       COUNT(b.id) AS total_bookings,
       COALESCE(SUM(b.total_amount), 0) AS total_revenue,
       COALESCE(SUM(CASE WHEN b.status = 'CONFIRMED' THEN b.total_amount ELSE 0 END), 0) AS confirmed_revenue
FROM events e
JOIN shows s ON e.id = s.event_id
LEFT JOIN bookings b ON s.id = b.show_id AND b.status = 'CONFIRMED'
GROUP BY e.id, e.name, e.category
ORDER BY total_revenue DESC;

-- =============================================================
-- Q10: Events by category with counts (admin dashboard)
-- =============================================================
SELECT category,
       COUNT(*) AS total_events,
       COUNT(CASE WHEN status = 'PUBLISHED' THEN 1 END) AS published,
       COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active,
       COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) AS drafts
FROM events
GROUP BY category
ORDER BY total_events DESC;