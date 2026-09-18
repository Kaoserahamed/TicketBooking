-- =============================================================
-- Test Query File: Admin Reports & Monitoring Queries
-- Covers: docs/04-api-design.md §4.8 (Admin)
--         docs/02-system-architecture.md §2.4 (admin, reports modules)
-- =============================================================

-- =============================================================
-- Q1: Admin Dashboard - Overview Statistics
-- =============================================================
SELECT
    (SELECT COUNT(*) FROM users) AS total_users,
    (SELECT COUNT(*) FROM events) AS total_events,
    (SELECT COUNT(*) FROM shows) AS total_shows,
    (SELECT COUNT(*) FROM venues) AS total_venues,
    (SELECT COUNT(*) FROM bookings) AS total_bookings,
    (SELECT COUNT(*) FROM tickets) AS total_tickets,
    (SELECT COUNT(*) FROM bookings WHERE status = 'CONFIRMED') AS confirmed_bookings,
    (SELECT COUNT(*) FROM bookings WHERE status = 'CANCELLED') AS cancelled_bookings,
    (SELECT COUNT(*) FROM bookings WHERE status = 'REFUNDED') AS refunded_bookings,
    COALESCE((SELECT SUM(total_amount) FROM bookings WHERE status = 'CONFIRMED'), 0) AS total_revenue;

-- =============================================================
-- Q2: Sales Report by Event (GET /api/v1/admin/reports/sales)
-- =============================================================
SELECT e.id, e.name AS event_name, e.category,
       COUNT(b.id) AS total_bookings,
       COALESCE(SUM(b.total_amount), 0) AS total_revenue,
       COALESCE(AVG(b.total_amount), 0) AS avg_booking_value,
       COUNT(CASE WHEN b.status = 'CONFIRMED' THEN 1 END) AS confirmed_bookings,
       COUNT(CASE WHEN b.status = 'CANCELLED' THEN 1 END) AS cancelled_bookings
FROM events e
JOIN shows s ON e.id = s.event_id
LEFT JOIN bookings b ON s.id = b.show_id
GROUP BY e.id, e.name, e.category
ORDER BY total_revenue DESC;

-- =============================================================
-- Q3: Revenue by Date Range (for sales reporting)
-- =============================================================
SELECT DATE(b.created_at) AS booking_date,
       COUNT(*) AS bookings_count,
       COALESCE(SUM(b.total_amount), 0) AS daily_revenue,
       COALESCE(AVG(b.total_amount), 0) AS avg_booking_value
FROM bookings b
WHERE b.created_at >= '2024-01-01'
  AND b.created_at < '2025-01-01'
  AND b.status = 'CONFIRMED'
GROUP BY DATE(b.created_at)
ORDER BY booking_date;

-- =============================================================
-- Q4: Booking Statistics by Status (GET /api/v1/admin/bookings)
-- =============================================================
SELECT status,
       COUNT(*) AS booking_count,
       COALESCE(SUM(total_amount), 0) AS total_amount,
       COALESCE(AVG(total_amount), 0) AS avg_amount,
       MIN(created_at) AS first_booking,
       MAX(created_at) AS last_booking
FROM bookings
GROUP BY status
ORDER BY booking_count DESC;

-- =============================================================
-- Q5: Top-Selling Shows (by revenue)
-- =============================================================
SELECT s.id AS show_id,
       e.name AS event_name,
       v.name AS venue_name,
       DATE_FORMAT(s.start_time, '%Y-%m-%d %H:00') AS show_time,
       COUNT(b.id) AS total_bookings,
       COUNT(CASE WHEN b.status = 'CONFIRMED' THEN 1 END) AS confirmed_bookings,
       COALESCE(SUM(CASE WHEN b.status = 'CONFIRMED' THEN b.total_amount END), 0) AS revenue
FROM shows s
JOIN events e ON s.event_id = e.id
JOIN venues v ON s.venue_id = v.id
LEFT JOIN bookings b ON s.id = b.show_id
WHERE s.status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED')
GROUP BY s.id, e.name, v.name, s.start_time
ORDER BY revenue DESC
LIMIT 10;

-- =============================================================
-- Q6: Venue Capacity Utilization Report
-- =============================================================
SELECT v.name AS venue_name, v.city, v.capacity,
       COUNT(s.id) AS total_shows,
       COUNT(b.id) AS total_bookings,
       COUNT(ss.id) AS total_seat_instances,
       COUNT(CASE WHEN ss.status = 'BOOKED' THEN 1 END) AS booked_seats,
       ROUND(COUNT(CASE WHEN ss.status = 'BOOKED' THEN 1 END) * 100.0 /
             NULLIF(COUNT(ss.id), 0), 2) AS occupancy_rate_pct
FROM venues v
JOIN seats st ON v.id = st.venue_id
JOIN show_seats ss ON st.id = ss.seat_id
JOIN shows s ON ss.show_id = s.id
LEFT JOIN bookings b ON s.id = b.show_id AND b.status = 'CONFIRMED'
WHERE s.status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED')
GROUP BY v.id, v.name, v.city, v.capacity
ORDER BY occupancy_rate_pct DESC;

-- =============================================================
-- Q7: Monitor Bookings by Status with Time (real-time monitoring)
-- =============================================================
SELECT status,
       COUNT(*) AS count,
       MIN(created_at) AS oldest,
       MAX(created_at) AS newest
FROM bookings
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY status
ORDER BY count DESC;

-- =============================================================
-- Q8: Payment Reconciliation Report
--    (docs/06 §6.2: verify payments against bookings)
-- =============================================================
SELECT p.id, p.provider, p.provider_transaction_id,
       p.amount, p.currency, p.status AS payment_status,
       b.booking_reference, b.total_amount AS booking_amount, b.status AS booking_status,
       CASE
           WHEN p.status = 'SUCCESS' AND b.status = 'CONFIRMED' THEN 'MATCH'
           WHEN p.status = 'FAILED' AND b.status IN ('CANCELLED', 'EXPIRED') THEN 'MATCH'
           WHEN p.status = 'REFUNDED' THEN 'REFUNDED'
           ELSE 'NEEDS_REVIEW'
       END AS reconciliation_status
FROM payments p
JOIN bookings b ON p.booking_id = b.id
WHERE DATE(p.created_at) = CURDATE()
ORDER BY p.created_at DESC;

-- =============================================================
-- Q9: Daily Booking Trend (last 7 days)
-- =============================================================
SELECT DATE(b.created_at) AS date,
       COUNT(*) AS bookings,
       COUNT(CASE WHEN b.status = 'CONFIRMED' THEN 1 END) AS confirmed,
       COALESCE(SUM(b.total_amount), 0) AS revenue
FROM bookings b
WHERE b.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY DATE(b.created_at)
ORDER BY date;

-- =============================================================
-- Q10: Admin - List all events with actions
-- =============================================================
SELECT e.id, e.name, e.category, e.status,
       COUNT(s.id) AS shows_count,
       COALESCE(SUM(b.total_amount), 0) AS total_revenue,
       DATE_FORMAT(e.updated_at, '%Y-%m-%d %H:%i:%s') AS last_updated
FROM events e
LEFT JOIN shows s ON e.id = s.event_id
LEFT JOIN bookings b ON s.id = b.show_id AND b.status = 'CONFIRMED'
GROUP BY e.id, e.name, e.category, e.status, e.updated_at
ORDER BY e.status, total_revenue DESC;