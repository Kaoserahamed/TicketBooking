import api from './client'
import type { User } from './auth'
import type { Event } from './events'
import type { Venue, VenueSeat, SeatType } from './venues'
import type { ShowDetail, ShowStatus } from './shows'
import type { Booking, BookingStatus } from './bookings'

// Backend contract — see backend/src/routes/admin.routes.js and
// backend/src/controllers/admin.controller.js (docs/04-api-design.md §4.8).
// RBAC is enforced server-side; the frontend only hides what the user cannot use.

export type AdminRole = 'USER' | 'ADMIN' | 'EVENT_MANAGER' | 'VENUE_MANAGER' | 'SUPPORT'
export type AdminUserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BLOCKED'
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'INACTIVE' | 'CANCELLED'
export type { SeatType }

export interface AdminListUsersParams {
  role?: AdminRole
  status?: AdminUserStatus
  limit?: number
}

/** Envelope: { status: 'ok', total, users } — no offset on this endpoint. */
export interface AdminListUsersResponse {
  status: 'ok'
  total: number
  users: User[]
}

export interface CreateEventInput {
  name: string
  description?: string | null
  category?: string | null
  posterUrl?: string | null
  status?: EventStatus
}

export type UpdateEventInput = Partial<CreateEventInput>

export interface AdminListEventsParams {
  status?: EventStatus
  category?: string
  search?: string
  limit?: number
  offset?: number
}

/** Envelope: { status: 'ok', events, total, limit, offset } */
export interface AdminListEventsResponse {
  status: 'ok'
  events: Event[]
  total: number
  limit: number
  offset: number
}

export interface CreateVenueInput {
  name: string
  address?: string | null
  city: string
  capacity: number
}

export type UpdateVenueInput = Partial<CreateVenueInput>

export interface CreateSeatInput {
  rowNumber: string
  seatNumber: string
  seatType?: SeatType
}

export interface CreateShowInput {
  eventId: number
  venueId: number
  startTime: string
  endTime: string
  status?: ShowStatus
  provisionInventory?: boolean
  defaultPrice?: number
}

/** event/venue are immutable — times/status only (show.validator.js). */
export interface UpdateShowInput {
  startTime?: string
  endTime?: string
  status?: ShowStatus
}

export interface AdminListBookingsParams {
  status?: BookingStatus
  limit?: number
  offset?: number
}

/** Envelope: { status: 'ok', total, bookings } */
export interface AdminListBookingsResponse {
  status: 'ok'
  total: number
  bookings: Booking[]
}

export const adminApi = {
  // GET /api/v1/admin/users?role=&status=&limit= (ADMIN only)
  listUsers: async (params: AdminListUsersParams = {}): Promise<AdminListUsersResponse> => {
    const { data } = await api.get<AdminListUsersResponse>('/admin/users', {
      params: cleanAdminParams(params),
    })
    return data
  },

  // GET /api/v1/admin/events?status=&category=&search=&limit=&offset=
  listEvents: async (params: AdminListEventsParams = {}): Promise<AdminListEventsResponse> => {
    const { data } = await api.get<AdminListEventsResponse>('/admin/events', {
      params: cleanAdminParams(params),
    })
    return data
  },

  // POST /api/v1/admin/events → 201 { status, event }
  createEvent: async (input: CreateEventInput): Promise<Event> => {
    const { data } = await api.post<{ status: string; event: Event }>(
      '/admin/events',
      cleanAdminBody(input)
    )
    return data.event
  },

  // PUT /api/v1/admin/events/:id → { status, event }
  updateEvent: async (id: number, input: UpdateEventInput): Promise<Event> => {
    const { data } = await api.put<{ status: string; event: Event }>(
      `/admin/events/${id}`,
      cleanAdminBody(input)
    )
    return data.event
  },

  // POST /api/v1/admin/venues → 201 { status, venue } (venue includes seat summary)
  createVenue: async (input: CreateVenueInput): Promise<Venue> => {
    const { data } = await api.post<{ status: string; venue: Venue }>(
      '/admin/venues',
      cleanAdminBody(input)
    )
    return data.venue
  },

  // PUT /api/v1/admin/venues/:id → { status, venue }
  updateVenue: async (id: number, input: UpdateVenueInput): Promise<Venue> => {
    const { data } = await api.put<{ status: string; venue: Venue }>(
      `/admin/venues/${id}`,
      cleanAdminBody(input)
    )
    return data.venue
  },

  // POST /api/v1/admin/venues/:id/seats → 201 { status, seat }
  createSeat: async (venueId: number, input: CreateSeatInput): Promise<VenueSeat> => {
    const { data } = await api.post<{ status: string; seat: VenueSeat }>(
      `/admin/venues/${venueId}/seats`,
      cleanAdminBody(input)
    )
    return data.seat
  },

  // PUT /api/v1/admin/venues/:id/seats/:seatId → { status, seat }
  updateSeat: async (venueId: number, seatId: number, seatType: SeatType): Promise<VenueSeat> => {
    const { data } = await api.put<{ status: string; seat: VenueSeat }>(
      `/admin/venues/${venueId}/seats/${seatId}`,
      { seatType }
    )
    return data.seat
  },

  // DELETE /api/v1/admin/venues/:id/seats/:seatId → { status, message: 'Seat deleted' }
  deleteSeat: async (venueId: number, seatId: number): Promise<string> => {
    const { data } = await api.delete<{ status: string; message: string }>(
      `/admin/venues/${venueId}/seats/${seatId}`
    )
    return data.message
  },

  // POST /api/v1/admin/shows → 201 { status, show } (toShowDetail shape)
  createShow: async (input: CreateShowInput): Promise<ShowDetail> => {
    const { data } = await api.post<{ status: string; show: ShowDetail }>('/admin/shows', input)
    return data.show
  },

  // PUT /api/v1/admin/shows/:id → { status, show }
  updateShow: async (id: number, input: UpdateShowInput): Promise<ShowDetail> => {
    const { data } = await api.put<{ status: string; show: ShowDetail }>(
      `/admin/shows/${id}`,
      input
    )
    return data.show
  },

  // GET /api/v1/admin/bookings?status=&limit=&offset= (ADMIN only)
  listBookings: async (
    params: AdminListBookingsParams = {}
  ): Promise<AdminListBookingsResponse> => {
    const { data } = await api.get<AdminListBookingsResponse>('/admin/bookings', {
      params: cleanAdminParams(params),
    })
    return data
  },
}

/** Strip empty/undefined params so the backend Zod validator never sees junk. */
function cleanAdminParams(params: object) {
  return Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, string | number | boolean] =>
        entry[1] !== undefined && entry[1] !== null && entry[1] !== ''
    )
  )
}

/** Body cleaner: drop empty strings so nullable-optional fields stay absent. */
function cleanAdminBody<T extends object>(body: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ) as Partial<T>
}
