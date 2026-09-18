# 6. Payment Domain

## 6.1 Architecture

**Never trust only the frontend payment response.**

### ❌ Bad Approach

```text
Frontend
   ↓
"Payment successful"
   ↓
Frontend tells backend
   ↓
Backend confirms booking
```

The frontend can be manipulated.

### ✅ Preferred Approach

```text
User
 ↓
Payment Gateway (redirect/checkout)
 ↓
Payment Provider
 ↓
Secure Webhook (server-to-server)
 ↓
Backend
 ↓
Verify transaction
 ↓
Confirm booking
```

## 6.2 Backend Verification Requirements

The backend should verify the following when processing a payment webhook:

- Transaction ID
- Amount
- Currency
- Merchant ID
- Payment status
- Booking ID
- Signature / webhook authenticity

## 6.3 Idempotency

Payment and booking APIs must be **idempotent** to handle duplicate or retried requests safely.

### Example:

```http
POST /api/v1/bookings
Idempotency-Key: 8f72c1e0-4d3a-...
```

If the request is accidentally sent twice:

```text
Request 1 → Booking #1001
Request 2 → Same Booking #1001
```

instead of:

```text
Booking #1001
Booking #1002
```

### Implementation Notes

- Store the `idempotency_key` alongside the booking record.
- On duplicate requests, return the cached result instead of creating a new booking.
- Apply the same pattern to payment creation endpoints.

## 6.4 Payment Gateway Timeout Handling

```text
Payment initiated
       ↓
Gateway timeout
       ↓
Booking = PAYMENT_PROCESSING
       ↓
Webhook / reconciliation
       ↓
SUCCESS / FAILED
```

**Do not immediately assume failure** simply because the client timed out. The payment may still succeed on the provider side. The booking should remain in `PAYMENT_PROCESSING` until the webhook confirms the final status.
