import api from './client'

export interface Event {
  id: number
  name: string
  description: string
  venueId: number
  venueName: string
  startDate: string
  endDate: string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  category: string
  coverImageUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface Show {
  id: number
  eventId: number
  eventName: string
  venueId: number
  venueName: string
  showDateTime: string
  duration: number
  status: string
  ticketPrice: number
  totalSeats: number
  availableSeats: number
  createdAt: string
}

export const eventApi = {
  listEvents: async (params?: { page?: number; limit?: number; category?: string; search?: string }) => {
    const { data } = await api.get('/events', { params })
    return data
  },

  getEvent: async (id: number) => {
    const { data } = await api.get(`/events/${id}`)
    return data
  },

  getEventShows: async (id: number, params?: { page?: number; limit?: number }) => {
    const { data } = await api.get(`/events/${id}/shows`, { params })
    return data
  },
}

export const showApi = {
  listShows: async (params?: { eventId?: number; page?: number; limit?: number; date?: string }) => {
    const { data } = await api.get('/shows', { params })
    return data
  },

  getShow: async (id: number) => {
    const { data } = await api.get(`/shows/${id}`)
    return data
  },

  getSeatMap: async (id: number) => {
    const { data } = await api.get(`/shows/${id}/seats`)
    return data
  },

  getAvailability: async (id: number) => {
    const { data } = await api.get(`/shows/${id}/availability`)
    return data
  },
}
