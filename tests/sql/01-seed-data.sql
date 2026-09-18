-- =============================================================
-- Test Data Seeding
-- Inserts realistic test data for all core tables
-- Must be run AFTER schema.sql (database: ticket_booking)
-- =============================================================

SET foreign_key_checks = 1;

-- =============================================================
-- 1. USERS  (docs/11-security.md: RBAC roles)
-- =============================================================
INSERT INTO users (name, email, phone, password_hash, role, status) VALUES
    ('Admin User',        'admin@ticketbooking.test',  '9999999999', '$2a$10$adminhash', 'ADMIN', 'ACTIVE'),
    ('Alice Smith',       'alice@example.com',         '8887776655', '$2a$10$alicehash', 'USER', 'ACTIVE'),
    ('Bob Johnson',       'bob@example.com',           '7776665544', '$2a$10$bobhash',   'USER', 'ACTIVE'),
    ('Carol Williams',    'carol@example.com',         '6665554433', '$2a$10$carolhash', 'USER', 'ACTIVE'),
    ('David Brown',       'david@example.com',         '5554443322', '$2a$10$davidhash', 'USER', 'ACTIVE'),
    ('Event Manager Eve', 'eve@venue.com',             '4443332211', '$2a$10$evehash',   'EVENT_MANAGER', 'ACTIVE'),
    ('Grace Lee',         'grace@example.com',         '3332221100', '$2a$10$gracehash', 'USER', 'SUSPENDED');

-- =============================================================
-- 2. VENUES
-- =============================================================
INSERT INTO venues (name, address, city, capacity) VALUES
    ('Grand Theater',   '123 Main St',  'New York',  500),
    ('City Auditorium', '456 Oak Ave',  'Chicago',   300),
        ('Sunset Cinema',   '789 Broadway', 'Los Angeles', 200);

-- =============================================================
-- 3. SEATS  (Seat layout for each venue)
--    Venue 1 (Grand Theater): 5 rows x 10 seats = 50 seats
--    Venue 2 (City Auditorium): 3 rows x 10 seats = 30 seats
--    Venue 3 (Sunset Cinema): 4 rows x 8 seats = 32 seats
-- =============================================================
-- Venue 1 seats: rows A-E, seats 1-10
INSERT INTO seats (venue_id, `row_number`, seat_number, seat_type)
SELECT 1, ROW_LETTER, seq,
       CASE WHEN ROW_LETTER IN ('A') THEN 'VIP'
            WHEN ROW_LETTER IN ('B') THEN 'PREMIUM'
            ELSE 'REGULAR' END
FROM (
    SELECT 'A' AS ROW_LETTER, n AS seq FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10) t1
    UNION ALL SELECT 'B', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10) t2
    UNION ALL SELECT 'C', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10) t3
    UNION ALL SELECT 'D', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10) t4
    UNION ALL SELECT 'E', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10) t5
) seat_layout;

-- Venue 2 seats: rows A-C, seats 1-10
INSERT INTO seats (venue_id, `row_number`, seat_number, seat_type)
SELECT 2, ROW_LETTER, seq,
       CASE WHEN ROW_LETTER IN ('A') THEN 'VIP' ELSE 'REGULAR' END
FROM (
    SELECT 'A' AS ROW_LETTER, n AS seq FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10) t1
    UNION ALL SELECT 'B', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10) t2
    UNION ALL SELECT 'C', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10) t3
) seat_layout;

-- Venue 3 seats: rows A-D, seats 1-8
INSERT INTO seats (venue_id, `row_number`, seat_number, seat_type)
SELECT 3, ROW_LETTER, seq,
       CASE WHEN ROW_LETTER IN ('A') THEN 'BALCONY' ELSE 'REGULAR' END
FROM (
    SELECT 'A' AS ROW_LETTER, n AS seq FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8) t1
    UNION ALL SELECT 'B', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8) t2
    UNION ALL SELECT 'C', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8) t3
    UNION ALL SELECT 'D', n FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8) t4
) seat_layout;

-- =============================================================
-- 4. EVENTS  (different categories and statuses)
-- =============================================================
INSERT INTO events (name, description, category, poster_url, status) VALUES
    ('Rock Concert: Thunder Beats',
     'A high-energy rock concert featuring Thunder Beats and special guests.',
     'Music', 'https://example.com/posters/thunder-beats.jpg', 'PUBLISHED'),
    ('Comedy Night: Laugh Out Loud',
     'Stand-up comedy showcase with top comedians.',
     'Comedy', 'https://example.com/posters/lol.jpg', 'PUBLISHED'),
    ('Broadway: The Phantom',
     'The legendary musical comes to life on stage.',
     'Theater', 'https://example.com/posters/phantom.jpg', 'PUBLISHED'),
    ('NBA: Lakers vs Celtics',
     'Premier basketball game between Lakers and Celtics.',
     'Sports', 'https://example.com/posters/lakers-celtics.jpg', 'PUBLISHED'),
    ('Jazz Evening: Midnight Notes',
     'Smooth jazz performance by Midnight Notes Quartet.',
     'Music', 'https://example.com/posters/jazz-midnight.jpg', 'PUBLISHED'),
    ('Tech Conference 2024',
     'Annual technology conference with industry leaders.',
     'Conference', 'https://example.com/posters/techconf2024.jpg', 'ACTIVE'),
    ('Silent Disco Night',
     'Electronic music experience with wireless headphones.',
          'Music', 'https://example.com/posters/silent-disco.jpg', 'DRAFT');

-- =============================================================
-- 5. SHOWS / SCHEDULES  (multiple shows per event)
-- =============================================================
INSERT INTO shows (event_id, venue_id, start_time, end_time, status) VALUES
    -- Rock Concert at Grand Theater (event 1)
    (1, 1, '2024-06-15 19:00:00', '2024-06-15 22:00:00', 'SCHEDULED'),
    (1, 1, '2024-06-16 19:00:00', '2024-06-16 22:00:00', 'SCHEDULED'),
    -- Comedy Night at City Auditorium (event 2)
    (2, 2, '2024-06-14 20:00:00', '2024-06-14 22:30:00', 'SCHEDULED'),
    -- Broadway at Grand Theater (event 3)
    (3, 1, '2024-06-15 14:00:00', '2024-06-15 17:00:00', 'SCHEDULED'),
    (3, 1, '2024-06-15 19:30:00', '2024-06-15 22:30:00', 'SCHEDULED'),
    -- NBA Game at City Auditorium (event 4)
    (4, 2, '2024-06-20 19:30:00', '2024-06-20 22:00:00', 'SCHEDULED'),
    -- Jazz Evening at Sunset Cinema (event 5)
    (5, 3, '2024-06-18 21:00:00', '2024-06-18 23:00:00', 'SCHEDULED'),
    -- Tech Conference at City Auditorium (event 6)
    (6, 2, '2024-06-25 09:00:00', '2024-06-25 17:00:00', 'SCHEDULED'),
        (6, 2, '2024-06-26 09:00:00', '2024-06-26 17:00:00', 'SCHEDULED');

-- =============================================================
-- 6. SHOW_SEATS  (Inventory for each show)
--    Generate show_seats from venue seats + pricing
-- =============================================================
-- Show 1 (Rock Concert at Grand Theater, venue 1): all 50 seats
INSERT INTO show_seats (show_id, seat_id, price, status)
SELECT 1, id,
       CASE WHEN seat_type = 'VIP' THEN 150.00
            WHEN seat_type = 'PREMIUM' THEN 100.00
            ELSE 50.00 END,
       'AVAILABLE'
FROM seats WHERE venue_id = 1;

-- Show 2 (Rock Concert day 2 at Grand Theater, venue 1): all 50 seats
INSERT INTO show_seats (show_id, seat_id, price, status)
SELECT 2, id,
       CASE WHEN seat_type = 'VIP' THEN 150.00
            WHEN seat_type = 'PREMIUM' THEN 100.00
            ELSE 50.00 END,
       'AVAILABLE'
FROM seats WHERE venue_id = 1;

-- Show 5 (Broadway evening at Grand Theater, venue 1): all 50 seats
INSERT INTO show_seats (show_id, seat_id, price, status)
SELECT 5, id,
       CASE WHEN seat_type = 'VIP' THEN 250.00
            WHEN seat_type = 'PREMIUM' THEN 180.00
            ELSE 90.00 END,
       'AVAILABLE'
FROM seats WHERE venue_id = 1;

-- Show 6 (NBA Game at City Auditorium, venue 2): all 30 seats
INSERT INTO show_seats (show_id, seat_id, price, status)
SELECT 6, id,
       CASE WHEN seat_type = 'VIP' THEN 120.00
            ELSE 60.00 END,
       'AVAILABLE'
FROM seats WHERE venue_id = 2;

-- Show 7 (Jazz at Sunset Cinema, venue 3): all 32 seats
INSERT INTO show_seats (show_id, seat_id, price, status)
SELECT 7, id,
       CASE WHEN seat_type = 'BALCONY' THEN 60.00
            ELSE 40.00 END,
       'AVAILABLE'
FROM seats WHERE venue_id = 3;

-- Show 8 (Tech Conference at City Auditorium, venue 2): all 30 seats
INSERT INTO show_seats (show_id, seat_id, price, status)
SELECT 8, id,
       CASE WHEN seat_type = 'VIP' THEN 200.00
            ELSE 100.00 END,
       'AVAILABLE'
FROM seats WHERE venue_id = 2;

-- Show 9 (Tech Conference day 2 at City Auditorium, venue 2): all 30 seats
INSERT INTO show_seats (show_id, seat_id, price, status)
SELECT 9, id,
       CASE WHEN seat_type = 'VIP' THEN 200.00
            ELSE 100.00 END,
       'AVAILABLE'
FROM seats WHERE venue_id = 2;

-- Show 3 (Comedy at City Auditorium, venue 2): all 30 seats
INSERT INTO show_seats (show_id, seat_id, price, status)
SELECT 3, id,
       CASE WHEN seat_type = 'VIP' THEN 80.00
            ELSE 40.00 END,
       'AVAILABLE'
FROM seats WHERE venue_id = 2;

-- Show 4 (Broadway matinee at Grand Theater, venue 1): all 50 seats
INSERT INTO show_seats (show_id, seat_id, price, status)
SELECT 4, id,
       CASE WHEN seat_type = 'VIP' THEN 200.00
            WHEN seat_type = 'PREMIUM' THEN 150.00
            ELSE 75.00 END,
       'AVAILABLE'
FROM seats WHERE venue_id = 1;

-- =============================================================
-- 7. PRE-EXISTING BOOKINGS / PAYMENTS / TICKETS
--    (To test reporting & query files with existing data)
-- =============================================================
-- Alice (user 2) books 2 seats for the Comedy show (show 3)
INSERT INTO bookings (user_id, show_id, booking_reference, idempotency_key,
    status, subtotal, discount, total_amount, currency, expires_at)
VALUES (2, 3, 'BK-COM-00001', 'idem-key-001', 'CONFIRMED', 120.00, 0.00, 120.00, 'INR', NULL);

INSERT INTO booking_items (booking_id, show_seat_id, price)
SELECT (SELECT id FROM bookings WHERE booking_reference = 'BK-COM-00001'),
       ss.id, ss.price
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 3 AND s.row_number = 'A' AND s.seat_number IN ('1','2');

UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
JOIN booking_items bi ON bi.show_seat_id = ss.id
SET ss.status = 'BOOKED',
    ss.booking_id = (SELECT id FROM bookings WHERE booking_reference = 'BK-COM-00001')
WHERE ss.show_id = 3 AND s.row_number = 'A' AND s.seat_number IN ('1','2');

-- Payment for Alice's booking
INSERT INTO payments (booking_id, provider, provider_transaction_id, amount, currency, status, payment_method)
SELECT id, 'Stripe', 'txn_stripe_001', total_amount, currency, 'SUCCESS', 'CARD'
FROM bookings WHERE booking_reference = 'BK-COM-00001';

-- Bob (user 3) books 1 seat for the Rock Concert (show 1)
INSERT INTO bookings (user_id, show_id, booking_reference, idempotency_key,
    status, subtotal, discount, total_amount, currency, expires_at)
VALUES (3, 1, 'BK-RCK-00002', 'idem-key-002', 'CONFIRMED', 50.00, 0.00, 50.00, 'INR', NULL);

INSERT INTO booking_items (booking_id, show_seat_id, price)
SELECT (SELECT id FROM bookings WHERE booking_reference = 'BK-RCK-00002'),
       ss.id, ss.price
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 1 AND s.row_number = 'C' AND s.seat_number = '5';

UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
JOIN booking_items bi ON bi.show_seat_id = ss.id
SET ss.status = 'BOOKED',
        ss.booking_id = (SELECT id FROM bookings WHERE booking_reference = 'BK-RCK-00002')
WHERE ss.show_id = 1 AND s.row_number = 'C' AND s.seat_number = '5';

-- Payment for Bob's booking
INSERT INTO payments (booking_id, provider, provider_transaction_id, amount, currency, status, payment_method)
SELECT id, 'Stripe', 'txn_stripe_002', total_amount, currency, 'SUCCESS', 'CARD'
FROM bookings WHERE booking_reference = 'BK-RCK-00002';

-- Carol (user 4) has a pending booking for Jazz show (show 7) - seats HELD
INSERT INTO bookings (user_id, show_id, booking_reference, idempotency_key,
    status, subtotal, discount, total_amount, currency, expires_at)
VALUES (4, 7, 'BK-JAZ-00003', 'idem-key-003', 'PAYMENT_PROCESSING', 80.00, 0.00, 80.00, 'INR', DATE_ADD(NOW(), INTERVAL 10 MINUTE));

INSERT INTO booking_items (booking_id, show_seat_id, price)
SELECT (SELECT id FROM bookings WHERE booking_reference = 'BK-JAZ-00003'),
       ss.id, ss.price
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 7 AND s.row_number = 'A' AND s.seat_number = '3';

UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
JOIN booking_items bi ON bi.show_seat_id = ss.id
SET ss.status = 'HELD',
    ss.hold_token = 'hold-jaz-003',
    ss.hold_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
        ss.booking_id = (SELECT id FROM bookings WHERE booking_reference = 'BK-JAZ-00003')
WHERE ss.show_id = 7 AND s.row_number = 'A' AND s.seat_number = '3';

-- Payment for Carol's booking (processing)
INSERT INTO payments (booking_id, provider, provider_transaction_id, amount, currency, status, payment_method)
SELECT id, 'Razorpay', 'txn_razorpay_003', total_amount, currency, 'PROCESSING', 'CARD'
FROM bookings WHERE booking_reference = 'BK-JAZ-00003';

-- David (user 5) has a CANCELLED booking for Broadway show (show 5)
INSERT INTO bookings (user_id, show_id, booking_reference, idempotency_key,
    status, subtotal, discount, total_amount, currency, expires_at)
VALUES (5, 5, 'BK-BRW-00004', 'idem-key-004', 'CANCELLED', 90.00, 10.00, 80.00, 'INR', NULL);

INSERT INTO booking_items (booking_id, show_seat_id, price)
SELECT (SELECT id FROM bookings WHERE booking_reference = 'BK-BRW-00004'),
       ss.id, ss.price
FROM show_seats ss
JOIN seats s ON ss.seat_id = s.id
WHERE ss.show_id = 5 AND s.row_number = 'B' AND s.seat_number = '4';

UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
SET ss.status = 'AVAILABLE', ss.booking_id = NULL
WHERE ss.show_id = 5 AND s.row_number = 'B' AND s.seat_number = '4';

INSERT INTO payments (booking_id, provider, provider_transaction_id, amount, currency, status, payment_method)
SELECT id, 'Stripe', 'txn_stripe_004', total_amount, currency, 'REFUNDED', 'CARD'
FROM bookings WHERE booking_reference = 'BK-BRW-00004';

-- Tickets for Alice and Bob (after successful payments)
INSERT INTO tickets (booking_id, ticket_number, qr_code, status, issued_at)
SELECT id, CONCAT('TKT-', LPAD(id, 8, '0')),
       CONCAT('qr://ticket/', id), 'ISSUED', NOW()
FROM bookings WHERE booking_reference IN ('BK-COM-00001', 'BK-RCK-00002');

-- Alice used her comedy ticket already (for entry validation testing)
UPDATE tickets
SET status = 'USED', used_at = NOW()
WHERE booking_id = (SELECT id FROM bookings WHERE booking_reference = 'BK-COM-00001');

-- =============================================================
-- Seeding Summary
-- =============================================================
SELECT CONCAT('Seeding Complete: ',
    (SELECT COUNT(*) FROM users), ' users, ',
    (SELECT COUNT(*) FROM venues), ' venues, ',
    (SELECT COUNT(*) FROM seats), ' seats, ',
    (SELECT COUNT(*) FROM events), ' events, ',
    (SELECT COUNT(*) FROM shows), ' shows, ',
    (SELECT COUNT(*) FROM show_seats), ' show_seats, ',
    (SELECT COUNT(*) FROM bookings), ' bookings, ',
    (SELECT COUNT(*) FROM booking_items), ' booking_items, ',
    (SELECT COUNT(*) FROM payments), ' payments, ',
    (SELECT COUNT(*) FROM tickets), ' tickets') AS 'Seeding Summary';