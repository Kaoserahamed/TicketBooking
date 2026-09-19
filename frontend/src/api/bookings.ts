import api from './client'

// Backend shapes — see backend/src/utils/serialize.js (toBooking /
// toBookingItem), backend/src/services/booking.service.js and
// backend/src/controllers/booking.controller.js.
export type BookingStatus = 'PENDING' | 'HOLDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED'

export interface BookingShowEvent {
  id: number
  name: string
  status: string | null
}

export interface BookingShowVenue {
  id: number
  name: string
  address: string | null
  city: string | null
  capacity: number
}

export interface BookingShow {
  id: number
  eventId: number
  venueId: number
  startTime: string
  endTime: string
  status: string
  event: BookingShowEvent
  venue: BookingShowVenue
}

export interface BookingItemSeat {
  id: number
  row?: string
  number?: string
  label?: string
  seatType?: string
}

export interface BookingItem {
  id: number
  bookingId: number
  showSeatId: number
  seat: BookingItemSeat
  price: number
}

export interface Booking {
  id: number
  userId: number
  showId: number
  bookingReference: string
  idempotencyKey: string | null
  status: BookingStatus
  subtotal: number
  discount: number
  totalAmount: number
  currency: string
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  show: BookingShow
  user: { id: number; name: string; email: string } | null
  items: BookingItem[]
}

export interface HoldBookingInput {
  showId: number
  /** Physical `seats.id` values (NOT show_seats ids) — see service holdBooking. */
  seatIds: number[]
  idempotencyKey?: string
}

export interface HoldBookingResponse {
  status: 'ok'
  booking: Booking
  items: BookingItem[]
  idempotentReplay: boolean
}

export interface BookingDetailResponse {
  status: 'ok'
  booking: Booking
  items: BookingItem[]
}

export interface CancelBookingResponse {
  status: 'ok'
  booking: Booking
  items: BookingItem[]
  released: number
  message: string
}

export interface ListBookingsParams {
  status?: BookingStatus
  limit?: number
  offset?: number
}

export interface ListBookingsResponse {
  status: 'ok'
  total: number
  bookings: Booking[]
}

/** Strip empty/undefined params so the Zod query validator never sees junk. */
function cleanBookingParams(params: {
  status?: string
  limit?: number
  offset?: number
}): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string | number] => {
      const [, v] = entry
      return v !== undefined && v !== null && v !== ''
    }),
  )
}

/** Generate a client idempotency key (uuid when available, fallback otherwise). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const bookingApi = {
  holdSeats: async (input: HoldBookingInput): Promise<HoldBookingResponse> => {
    const { data } = await api.post<HoldBookingResponse>('/bookings/hold', input)
    return data
  },

  getBooking: async (id: number): Promise<BookingDetailResponse> => {
    const { data } = await api.get<BookingDetailResponse>(`/bookings/${id}`)
    return data
  },

  cancelBooking: async (id: number): Promise<CancelBookingResponse> => {
    const { data } = await api.post<CancelBookingResponse>(`/bookings/${id}/cancel`)
    return data
  },

  listMyBookings: async (params: ListBookingsParams = {}): Promise<ListBookingsResponse> => {
    const { data } = await api.get<ListBookingsResponse>('/bookings', {
      params: cleanBookingParams(params),
    })
    return data
  },
}
