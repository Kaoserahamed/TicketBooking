# 4. API Design

## 4.1 Conventions

All API endpoints follow these conventions:

- **Base path:** `/api/v1`
- **Content-Type:** `application/json`
- **Authentication:** Bearer JWT access token
- **Idempotency:** Booking and payment endpoints accept an `Idempotency-Key` header
- **HTTPS:** Required in all environments

## 4.2 Authentication

```http
POST   /api/v1/auth/register      # Register a new user
POST   /api/v1/auth/login         # Login and receive tokens
POST   /api/v1/auth/refresh       # Refresh access token
POST   /api/v1/auth/logout        # Logout (invalidate refresh token)
```

## 4.3 Events

```http
GET    /api/v1/events             # List events (with filtering)
GET    /api/v1/events/{id}        # Get event details
GET    /api/v1/events/{id}/shows  # Get showtimes for an event
```

## 4.4 Seats

```http
GET    /api/v1/shows/{id}/seats         # Get seat map for a show
GET    /api/v1/shows/{id}/availability   # Get real-time seat availability
```

## 4.5 Booking

```http
POST   /api/v1/bookings/hold          # Temporarily hold selected seats
GET    /api/v1/bookings/{id}          # Get booking details
POST   /api/v1/bookings/{id}/cancel   # Cancel a booking
```

## 4.6 Payment

```http
POST   /api/v1/payments/create      # Initiate a payment
POST   /api/v1/payments/webhook     # Receive payment provider webhook (no auth — verified by signature)
GET    /api/v1/payments/{id}        # Get payment status
```

## 4.7 Tickets

```http
GET    /api/v1/tickets/{id}         # Get ticket details
GET    /api/v1/tickets/{id}/qr      # Download/view QR code
```

## 4.8 Admin

```http
GET    /api/v1/admin/events          # Admin: list events
POST   /api/v1/admin/events          # Admin: create event
PUT    /api/v1/admin/events/{id}     # Admin: update event
GET    /api/v1/admin/bookings        # Admin: monitor bookings
GET    /api/v1/admin/reports/sales   # Admin: sales reports
```

## 4.9 Frontend Integration

The frontend (React + TypeScript + Vite) consumes these REST endpoints via an HTTP client (e.g., Axios or `fetch`).

- **Access token** is stored in memory (or an httpOnly cookie) for security.
- **Refresh token** is stored in an httpOnly, secure, SameSite cookie.
- **Reactive state** is managed via React hooks or state management libraries.
