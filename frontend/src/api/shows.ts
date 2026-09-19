import api from './client'
import type { EventVenueSummary } from './events'

// Backend shapes — see backend/src/utils/serialize.js
// (toShowDetail / toShowSeat / toAvailability) and
// backend/src/services/show.service.js.
export type ShowStatus = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED'

export interface ShowDetail {
  id: number
  eventId: number
  event: { id: number; name: string; status: string }
  venueId: number
  venue: EventVenueSummary
  startTime: string
  endTime: string
  status: string
  createdAt: string
  seats: {
    total: number
    available: number
    held: number
    booked: number
    blocked: number
  }
}

export interface ShowListParams {
  eventId?: number
  venueId?: number
  status?: ShowStatus
  upcoming?: boolean
  limit?: number
  offset?: number
}

export interface ShowListResponse {
  status: 'ok'
  shows: ShowDetail[]
  total: number
  limit: number
  offset: number
}

export type ShowSeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'BLOCKED'

export interface ShowSeat {
  showSeatId: number
  showId: number
  seatId: number
  row: string
  number: string
  label: string
  seatType: string
  price: string | number
  status: ShowSeatStatus
  holdExpiresAt: string | null
}

export interface SeatMapResponse {
  status: 'ok'
  showId: number
  total: number
  seats: ShowSeat[]
}

export interface AvailabilityRow {
  row: string
  total: number
  available: number
  held: number
  booked: number
  blocked: number
}

export interface Availability {
  showId: number
  total: number
  available: number
  held: number
  booked: number
  blocked: number
  byRow: AvailabilityRow[]
}

/** Strip empty/undefined params so the backend Zod validator never sees junk. */
function cleanShowParams(params: {
  eventId?: number
  venueId?: number
  status?: string
  upcoming?: boolean
  limit?: number
  offset?: number
}): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string | number | boolean] => {
      const [, v] = entry
      return v !== undefined && v !== null && v !== ''
    })
  )
}

export const showApi = {
  listShows: async (params: ShowListParams = {}): Promise<ShowListResponse> => {
    const { data } = await api.get<ShowListResponse>('/shows', {
      params: cleanShowParams(params),
    })
    return data
  },

  getShow: async (id: number): Promise<ShowDetail> => {
    const { data } = await api.get<{ status: string; show: ShowDetail }>(`/shows/${id}`)
    return data.show
  },

  getSeatMap: async (id: number): Promise<SeatMapResponse> => {
    const { data } = await api.get<SeatMapResponse>(`/shows/${id}/seats`)
    return data
  },

  getAvailability: async (id: number): Promise<Availability> => {
    const { data } = await api.get<{ status: string; availability: Availability }>(
      `/shows/${id}/availability`
    )
    return data.availability
  },
}
