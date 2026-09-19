import api from './client'

// Backend shapes — see backend/src/utils/serialize.js (toEvent / toShow)
// and backend/src/services/event.service.js.
export type PublicEventStatus = 'PUBLISHED' | 'ACTIVE'

export interface Event {
  id: number
  name: string
  description: string | null
  category: string | null
  posterUrl: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface EventListParams {
  category?: string
  search?: string
  status?: PublicEventStatus
  limit?: number
  offset?: number
}

export interface EventListResponse {
  status: 'ok'
  events: Event[]
  total: number
  limit: number
  offset: number
}

export interface EventVenueSummary {
  id: number
  name: string
  address: string | null
  city: string | null
  capacity: number
}

// toShow() row for GET /events/:id/shows
export interface EventShow {
  id: number
  eventId: number
  venueId: number
  venue: EventVenueSummary
  startTime: string
  endTime: string
  status: string
  createdAt: string
}

export interface EventShowsParams {
  limit?: number
  offset?: number
}

export interface EventShowsResponse {
  status: 'ok'
  eventId: number
  shows: EventShow[]
  total: number
  limit: number
  offset: number
}

/** Strip empty params so the backend validator never sees `search=` etc. */
function cleanParams(params: {
  category?: string
  search?: string
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

export const eventApi = {
  listEvents: async (params: EventListParams = {}): Promise<EventListResponse> => {
    const { data } = await api.get<EventListResponse>('/events', {
      params: cleanParams(params),
    })
    return data
  },

  getEvent: async (id: number): Promise<Event> => {
    const { data } = await api.get<{ status: string; event: Event }>(`/events/${id}`)
    return data.event
  },

  getEventShows: async (id: number, params: EventShowsParams = {}): Promise<EventShowsResponse> => {
    const { data } = await api.get<EventShowsResponse>(`/events/${id}/shows`, {
      params: cleanParams(params),
    })
    return data
  },
}

export { showApi } from './shows'
