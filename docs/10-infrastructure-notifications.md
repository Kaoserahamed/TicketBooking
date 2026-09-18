# 10. Notifications Infrastructure

## 10.1 Message Queue

Use asynchronous processing (via a message queue) for operations that do not need to block the booking request.

### Example Flow

```text
Booking Confirmed
       │
       ▼
Message Queue (RabbitMQ / Kafka)
       │
  ┌─────┼────────┐
  ▼     ▼        ▼
Email  SMS     Push
```

### Other Queue Jobs

- Ticket generation (PDF)
- Email delivery
- SMS delivery
- Push notifications
- Analytics event processing
- Refund processing
- Search indexing
- Expired booking cleanup

## 10.2 Notification Service

The notification service consumes messages from the queue:

```text
BookingConfirmedEvent

{
    booking_id,
    user_id,
    email,
    ticket_id
}
```

Then:

```text
Email Worker → Email provider (SendGrid / SES)
SMS Worker   → SMS provider (Twilio)
Push Worker  → Push provider (FCM / APNs)
```

### Key Principle

A failure in email delivery should **not** cancel a successful booking. Notifications are best-effort and retried independently of the core booking transaction.
