-- =============================================================
-- Test Query File: Payment Queries
-- Covers: docs/04-api-design.md §4.6 (Payment)
--         docs/06-domain-payment.md (Architecture, Idempotency, Webhook)
-- =============================================================

-- =============================================================
-- Q1: Create a payment record (POST /api/v1/payments/create)
--    Called after user is redirected to payment gateway
-- =============================================================
INSERT INTO payments (booking_id, provider, provider_transaction_id,
    amount, currency, status, payment_method)
SELECT b.id, 'Stripe', 'txn_stripe_new_001', b.total_amount, b.currency,
       'INITIATED', 'CARD'
FROM bookings b
WHERE b.booking_reference = 'BK-BRW-HOLD-001'
  AND b.status = 'PAYMENT_PROCESSING';

-- Verify payment was created
SELECT p.id, p.booking_id, p.provider, p.provider_transaction_id,
       p.amount, p.currency, p.status, p.payment_method
FROM payments p
WHERE p.provider_transaction_id = 'txn_stripe_new_001';

-- =============================================================
-- Q2: Payment status update (PROCESSING -> SUCCESS/FAILED)
--    Simulates webhook notification from payment gateway
--    (docs/06 §6.2: verify transaction ID, amount, currency, status)
-- =============================================================
-- Webhook receives success notification
-- NOTE: filtered by provider_transaction_id directly (a subquery on `payments`
-- inside an UPDATE of `payments` raises ERROR 1093).
UPDATE payments
SET status = 'SUCCESS',
    updated_at = NOW()
WHERE provider_transaction_id = 'txn_stripe_new_001'
  AND status IN ('INITIATED', 'PROCESSING');

-- Verify payment success
SELECT p.id, p.provider, p.provider_transaction_id, p.amount, p.currency, p.status
FROM payments p
WHERE p.provider_transaction_id = 'txn_stripe_new_001';

-- =============================================================
-- Q3: Idempotency check for payments (docs/06 §6.3)
--    Prevent duplicate payments for the same transaction
-- =============================================================
-- Check if a payment already exists for this transaction ID
SELECT id, booking_id, status, provider_transaction_id
FROM payments
WHERE provider_transaction_id = 'txn_stripe_001';

-- =============================================================
-- Q4: Payment verification query (POST /payments/webhook)
--    Verifies payment details against booking before confirming
--    (docs/06 §6.2: check amount, currency, booking_id, status)
-- =============================================================
SELECT p.id AS payment_id,
       p.provider, p.provider_transaction_id,
       p.amount AS payment_amount, b.total_amount AS booking_amount,
       p.currency AS payment_currency, b.currency AS booking_currency,
       p.status AS payment_status,
       CASE
           WHEN p.amount = b.total_amount
            AND p.currency = b.currency
            AND p.status = 'SUCCESS'
           THEN 'VERIFIED'
           ELSE 'MISMATCH'
       END AS verification_result
FROM payments p
JOIN bookings b ON p.booking_id = b.id
WHERE p.provider_transaction_id = 'txn_stripe_001';

-- =============================================================
-- Q5: Get payment status (GET /api/v1/payments/{id})
-- =============================================================
SELECT p.id, p.provider, p.provider_transaction_id,
       p.amount, p.currency, p.status, p.payment_method,
       DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
       DATE_FORMAT(p.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
       b.booking_reference,
       u.name AS user_name
FROM payments p
JOIN bookings b ON p.booking_id = b.id
JOIN users u ON b.user_id = u.id
WHERE p.id = 1;

-- =============================================================
-- Q6: Full payment success flow (transaction)
--    Updates: payment SUCCESS -> booking CONFIRMED -> seats BOOKED
--    (docs/05 §5.7 Booking Flow: webhook -> verify -> confirm)
-- =============================================================
START TRANSACTION;

-- 1. Mark payment as successful (if in eligible state)
UPDATE payments
SET status = 'SUCCESS', updated_at = NOW()
WHERE booking_id = (SELECT id FROM bookings WHERE booking_reference = 'BK-BRW-HOLD-001')
  AND status IN ('INITIATED', 'PROCESSING');

-- 2. Update booking status to CONFIRMED
UPDATE bookings
SET status = 'CONFIRMED',
    updated_at = NOW()
WHERE booking_reference = 'BK-BRW-HOLD-001'
  AND status IN ('PENDING', 'PAYMENT_PROCESSING');

-- 3. Mark seats as BOOKED
UPDATE show_seats ss
JOIN booking_items bi ON ss.id = bi.show_seat_id
JOIN bookings b ON bi.booking_id = b.id
SET ss.status = 'BOOKED',
    ss.hold_token = NULL,
    ss.hold_expires_at = NULL
WHERE b.booking_reference = 'BK-BRW-HOLD-001';

COMMIT;

-- Verify the full flow
SELECT b.booking_reference, b.status AS booking_status,
       p.status AS payment_status,
       GROUP_CONCAT(CONCAT(s.row_number, s.seat_number)) AS booked_seats
FROM bookings b
JOIN payments p ON b.id = p.booking_id
JOIN booking_items bi ON b.id = bi.booking_id
JOIN show_seats ss ON bi.show_seat_id = ss.id
JOIN seats s ON ss.seat_id = s.id
WHERE b.booking_reference = 'BK-BRW-HOLD-001'
GROUP BY b.id, p.id;

-- =============================================================
-- Q7: Handle failed payment (PROCESSING -> FAILED)
-- =============================================================
-- Create a test booking in PAYMENT_PROCESSING for failure testing
INSERT INTO bookings (user_id, show_id, booking_reference, idempotency_key,
    status, subtotal, discount, total_amount, currency, expires_at)
VALUES (5, 5, 'BK-BRW-FAIL-003', 'idem-key-fail-003',
        'PAYMENT_PROCESSING', 90.00, 10.00, 80.00, 'INR',
        DATE_ADD(NOW(), INTERVAL 10 MINUTE));

INSERT INTO payments (booking_id, provider, provider_transaction_id,
    amount, currency, status, payment_method)
SELECT id, 'Stripe', 'txn_stripe_fail_003', total_amount, currency, 'PROCESSING', 'CARD'
FROM bookings WHERE booking_reference = 'BK-BRW-FAIL-003';

-- Simulate payment failure
UPDATE payments
SET status = 'FAILED', updated_at = NOW()
WHERE provider_transaction_id = 'txn_stripe_fail_003';

-- NOTE: bookings.status has no 'FAILED' value (docs/03-database-design.md §3.8:
-- PENDING, PAYMENT_PROCESSING, CONFIRMED, CANCELLED, EXPIRED, REFUNDED). A failed
-- payment therefore cancels the booking; only payments.status uses 'FAILED'.
UPDATE bookings
SET status = 'CANCELLED', updated_at = NOW()
WHERE booking_reference = 'BK-BRW-FAIL-003'
  AND status = 'PAYMENT_PROCESSING';

-- Release the held seats
UPDATE show_seats ss
JOIN seats s ON ss.seat_id = s.id
SET ss.status = 'AVAILABLE', ss.hold_token = NULL, ss.hold_expires_at = NULL
WHERE ss.show_id = 5 AND s.row_number = 'B' AND s.seat_number = '4';

-- =============================================================
-- Q8: Get all payments by status (for admin / reconciliation)
-- =============================================================
SELECT p.id, p.provider, p.provider_transaction_id, p.amount, p.currency,
       p.status, p.payment_method,
       DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
       b.booking_reference, u.email
FROM payments p
JOIN bookings b ON p.booking_id = b.id
JOIN users u ON b.user_id = u.id
WHERE p.status = 'FAILED'
ORDER BY p.created_at DESC;