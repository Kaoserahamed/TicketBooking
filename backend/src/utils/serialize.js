'use strict';

/**
 * Response serializers.
 *
 * Keeping these in one place guarantees that internal columns (above all
 * `password_hash`) can never leak through an API response.
 */

/**
 * Shape a `users` row for API responses.
 *
 * @param {object} row raw database row
 * @returns {object} public user object
 */
function toPublicUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    emailVerified: Boolean(row.email_verified_at),
    emailVerifiedAt: row.email_verified_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Shape an `events` row for API responses.
 */
function toEvent(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    category: row.category,
    posterUrl: row.poster_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Shape a show row (joined with its venue) for API responses.
 */
function toShow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    venueId: Number(row.venue_id),
    venue: {
      id: Number(row.venue_id),
      name: row.venue_name,
      address: row.venue_address,
      city: row.venue_city,
      capacity: Number(row.venue_capacity),
    },
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Shape a `venues` row for API responses.
 */
function toVenue(row) {
  if (!row) {
    return null;
  }

  const venue = {
    id: Number(row.id),
    name: row.name,
    address: row.address,
    city: row.city,
    capacity: Number(row.capacity),
    createdAt: row.created_at,
  };

  // Present only when the seat-summary join ran (detail endpoints).
  if (row.total_seats !== undefined) {
    venue.seats = {
      total: Number(row.total_seats),
      byType: {
        VIP: Number(row.vip_seats),
        PREMIUM: Number(row.premium_seats),
        REGULAR: Number(row.regular_seats),
        BALCONY: Number(row.balcony_seats),
        BOX: Number(row.box_seats),
      },
    };
  }

  return venue;
}

/**
 * Shape a `seats` row for API responses.
 */
function toSeat(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    venueId: Number(row.venue_id),
    row: row.row_number,
    number: row.seat_number,
    label: `${row.row_number}${row.seat_number}`,
    seatType: row.seat_type,
    createdAt: row.created_at,
  };
}

/**
 * Shape a show row (joined with event + venue + counts) for API responses.
 */
function toShowDetail(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    event: { id: Number(row.event_id), name: row.event_name, status: row.event_status },
    venueId: Number(row.venue_id),
    venue: {
      id: Number(row.venue_id),
      name: row.venue_name,
      address: row.venue_address,
      city: row.venue_city,
      capacity: Number(row.venue_capacity),
    },
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    createdAt: row.created_at,
    seats: {
      total: Number(row.total_seats),
      available: Number(row.available_seats),
      held: Number(row.held_seats),
      booked: Number(row.booked_seats),
      blocked: Number(row.blocked_seats),
    },
  };
}

/**
 * Shape a show_seats row (joined with its seat) for the seat map.
 */
function toShowSeat(row) {
  if (!row) {
    return null;
  }

  return {
    showSeatId: Number(row.show_seat_id),
    showId: Number(row.show_id),
    seatId: Number(row.seat_id),
    row: row.row_number,
    number: row.seat_number,
    label: `${row.row_number}${row.seat_number}`,
    seatType: row.seat_type,
    price: row.price,
    status: row.status,
    holdExpiresAt: row.hold_expires_at,
  };
}

/**
 * Shape the availability response (totals + per-row breakdown).
 */
function toAvailability(showId, totals, byRow) {
  const num = (v) => Number(v ?? 0);
  return {
    showId: Number(showId),
    total: num(totals.total_seats),
    available: num(totals.available),
    held: num(totals.held),
    booked: num(totals.booked),
    blocked: num(totals.blocked),
    byRow: byRow.map((r) => ({
      row: r.row_number,
      total: num(r.total_seats),
      available: num(r.available),
      held: num(r.held),
      booked: num(r.booked),
      blocked: num(r.blocked),
    })),
  };
}

/** Shape a booking + its items for API responses.
 */
function toBooking(row, items = []) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    showId: Number(row.show_id),
    bookingReference: row.booking_reference,
    idempotencyKey: row.idempotency_key ?? null,
    status: row.status,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    show: {
      id: Number(row.show_id),
      eventId: Number(row.event_id),
      venueId: Number(row.venue_id),
      startTime: row.show_start_time,
      endTime: row.show_end_time,
      status: row.show_status,
      event: {
        id: Number(row.event_id),
        name: row.event_name,
        status: row.event_status ?? null,
      },
      venue: {
        id: Number(row.venue_id),
        name: row.venue_name,
        address: row.venue_address,
        city: row.venue_city,
        capacity: Number(row.venue_capacity),
      },
    },
    user:
      row.user_name != null
        ? { id: Number(row.user_id), name: row.user_name, email: row.user_email }
        : null,
    items: items.map(toBookingItem),
  };
}

/**
 * Shape a booking_item + its seat for API responses.
 */
function toBookingItem(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    bookingId: Number(row.booking_id),
    showSeatId: Number(row.show_seat_id),
    seat:
      row.row_number != null
        ? {
            id: Number(row.seat_id),
            row: row.row_number,
            number: row.seat_number,
            label: `${row.row_number}${row.seat_number}`,
            seatType: row.seat_type,
          }
        : { id: Number(row.seat_id) },
    price: Number(row.price),
  };
}

module.exports = {
  toPublicUser,
  toEvent,
  toShow,
  toVenue,
  toSeat,
  toShowDetail,
  toShowSeat,
  toAvailability,
  toBooking,
  toBookingItem,
};
