import api from './client'

// Backend shapes — see backend/src/utils/serialize.js (toVenue / toSeat)
// and backend/src/services/venue.service.js.
export interface VenueSeatSummary {
  total: number
  // Backend builds byType by counting seat rows, so a venue with no seats
  // (or only some types) omits the missing keys.
  byType: Partial<Record<SeatType, number>>
}

export interface Venue {
  id: number
  name: string
  address: string | null
  city: string | null
  capacity: number
  createdAt: string
  seats?: VenueSeatSummary
}

export interface VenueListParams {
  city?: string
  search?: string
  limit?: number
  offset?: number
}

export interface VenueListResponse {
  status: 'ok'
  venues: Venue[]
  total: number
  limit: number
  offset: number
}

export type SeatType = 'REGULAR' | 'VIP' | 'PREMIUM' | 'BALCONY' | 'BOX'

export interface VenueSeat {
  id: number
  venueId: number
  row: string
  number: string
  label: string
  seatType: SeatType
  createdAt: string
}

export interface VenueSeatsParams {
  seatType?: SeatType
  limit?: number
  offset?: number
}

export interface VenueSeatsResponse {
  status: 'ok'
  venueId: number
  seats: VenueSeat[]
  total: number
  limit: number
  offset: number
}

/** Strip empty/undefined params so the Zod query validator never sees junk. */
function cleanVenueParams(params: {
  city?: string
  search?: string
  seatType?: string
  limit?: number
  offset?: number
}): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string | number] => {
      const [, v] = entry
      return v !== undefined && v !== null && v !== ''
    })
  )
}

export const venueApi = {
  listVenues: async (params: VenueListParams = {}): Promise<VenueListResponse> => {
    const { data } = await api.get<VenueListResponse>('/venues', {
      params: cleanVenueParams(params),
    })
    return data
  },

  getVenue: async (id: number): Promise<Venue> => {
    const { data } = await api.get<{ status: string; venue: Venue }>(`/venues/${id}`)
    return data.venue
  },

  listSeats: async (id: number, params: VenueSeatsParams = {}): Promise<VenueSeatsResponse> => {
    const { data } = await api.get<VenueSeatsResponse>(`/venues/${id}/seats`, {
      params: cleanVenueParams(params),
    })
    return data
  },
}
