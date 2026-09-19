# 1. Overview

## 1.1 Purpose

The Ticket Booking Application is a scalable web platform that allows users to discover events, view schedules and seat availability, temporarily reserve seats, make payments, and receive confirmed tickets.

The system is designed for approximately **100,000 registered users**, with significantly higher concurrency during popular-event ticket releases.

The primary architectural challenge is **preventing double booking** while maintaining high availability and acceptable response times during traffic spikes.

---

# 2. Objectives

## 2.1 Functional Objectives

The system shall allow users to:

- Register and log in.
- Browse events, movies, routes, or shows.
- Search and filter available tickets.
- View event details.
- View seat maps.
- Check real-time seat availability.
- Select seats.
- Temporarily hold selected seats.
- Make payments.
- Receive booking confirmation.
- Download/view digital tickets.
- View booking history.
- Cancel tickets according to applicable policies.
- Receive email/SMS/push notifications.

Administrators shall be able to:

- Create and manage events.
- Configure venues.
- Configure seats.
- Configure schedules/showtimes.
- Configure ticket categories and prices.
- Monitor bookings.
- Manage cancellations/refunds.
- View sales reports.
- Manage users.

## 2.2 Non-Functional Requirements

| Requirement               | Target                                   |
| ------------------------- | ---------------------------------------- |
| Registered users          | 100,000+                                 |
| Peak concurrent users     | 10,000+                                  |
| Peak booking attempts     | 1,000–5,000/sec depending on event       |
| API availability          | 99.9%+                                   |
| Normal API latency        | <300 ms                                  |
| Seat availability latency | <200 ms                                  |
| Booking confirmation      | <5 sec excluding payment-provider delays |
| Database durability       | High                                     |
| Data consistency          | Strong for seat inventory                |
| Search consistency        | Eventual consistency acceptable          |
| Horizontal scaling        | Required                                 |
| Zero double booking       | Mandatory                                |
| Secure payment handling   | Mandatory                                |

> The exact infrastructure capacity should ultimately be validated through load testing because "100K users" alone does not determine required server capacity.

---

# 3. Assumptions

The system assumes:

- 100,000 registered users.
- Approximately 10,000 peak concurrent users.
- Most users browse rather than book simultaneously.
- A popular event can cause a sudden traffic spike.
- A seat is held for approximately 5–10 minutes during checkout.
- Payment is processed through an external payment gateway.
- The application may eventually support multiple venues/events simultaneously.
- Ticket inventory is finite and must never be oversold.
