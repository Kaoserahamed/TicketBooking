-- =============================================================
-- Test Query File: User & Authentication Queries
-- Covers: docs/04-api-design.md §4.2 (Authentication), §4.8 (Admin: Manage users)
--         docs/11-security.md §11.1 (RBAC)
-- =============================================================

-- =============================================================
-- Q1: Check if email is already registered (registration validation)
-- =============================================================
-- This query checks email uniqueness before allowing registration.
-- SELECT returns a row if the email already exists.
SELECT id, email FROM users WHERE email = 'alice@example.com';

-- =============================================================
-- Q2: Check if phone is already registered
-- =============================================================
SELECT id, phone FROM users WHERE phone = '8887776655';

-- =============================================================
-- Q3: Register a new user (INSERT)
-- =============================================================
INSERT INTO users (name, email, phone, password_hash, role, status)
VALUES ('Test User New', 'testuser@example.com', '1234567890',
        '$2a$10$testhashtesthash', 'USER', 'ACTIVE');

-- Verify the new user was inserted
SELECT id, name, email, phone, role, status,
       DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
FROM users WHERE email = 'testuser@example.com';

-- =============================================================
-- Q4: User login verification (SELECT by email + password check)
-- =============================================================
-- In the application, the app would fetch the password_hash from the DB
-- and compare it using bcrypt. This query simulates the fetch.
SELECT id, name, email, password_hash, role, status
FROM users
WHERE email = 'alice@example.com' AND status = 'ACTIVE';

-- Attempt login for a suspended user (should return nothing)
SELECT id, name, email, password_hash, role, status
FROM users
WHERE email = 'grace@example.com' AND status = 'ACTIVE';

-- =============================================================
-- Q5: Get a user's profile by ID (GET /users/{id})
-- =============================================================
SELECT u.id, u.name, u.email, u.phone, u.role, u.status,
       DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
       DATE_FORMAT(u.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
       COUNT(b.id) AS total_bookings,
       COALESCE(SUM(CASE WHEN b.status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS confirmed_bookings
FROM users u
LEFT JOIN bookings b ON u.id = b.user_id
WHERE u.id = 2
GROUP BY u.id, u.name, u.email, u.phone, u.role, u.status, u.created_at, u.updated_at;

-- =============================================================
-- Q6: Update user profile (PUT /users/{id})
-- =============================================================
UPDATE users
SET name = 'Alice Smith-Jones', phone = '8887776656'
WHERE id = 2;

-- Verify the update
SELECT name, phone FROM users WHERE id = 2;

-- =============================================================
-- Q7: Admin: List all users with role filtering
-- =============================================================
SELECT id, name, email, phone, role, status,
       DATE_FORMAT(created_at, '%Y-%m-%d') AS registered_date
FROM users
WHERE role IN ('USER', 'ADMIN', 'EVENT_MANAGER', 'VENUE_MANAGER', 'SUPPORT')
ORDER BY role, created_at DESC;

-- =============================================================
-- Q8: Admin: Update user status (suspend/reactivate)
-- =============================================================
-- Suspend a user (admin action)
UPDATE users SET status = 'SUSPENDED' WHERE email = 'testuser@example.com';
-- Then reactivate
UPDATE users SET status = 'ACTIVE' WHERE email = 'testuser@example.com';

-- =============================================================
-- Q9: Count users by role and status (admin dashboard)
-- =============================================================
SELECT role, status, COUNT(*) AS user_count
FROM users
GROUP BY role, status
ORDER BY role, status;

-- =============================================================
-- Q10: User booking history (GET /bookings for a user)
-- =============================================================
SELECT b.id, b.booking_reference, b.status, b.total_amount, b.currency,
       e.name AS event_name,
       s.start_time, v.name AS venue_name,
       DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i:%s') AS booked_at,
       p.status AS payment_status
FROM bookings b
JOIN users u ON b.user_id = u.id
JOIN shows s ON b.show_id = s.id
JOIN events e ON s.event_id = e.id
JOIN venues v ON s.venue_id = v.id
LEFT JOIN payments p ON p.booking_id = b.id
WHERE u.id = 2
ORDER BY b.created_at DESC;