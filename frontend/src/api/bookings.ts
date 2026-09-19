import api from './client'

export interface Booking {
  id: number
  userId: number
  showId: number
  showName: string
  eventName: string
  venueName: string
  showDateTime: string
  seats: Seat[]
  totalAmount: number
  status: 'HELD' | 'CONFIRMED' | 'CANCELLED'
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED'
  paymentId: string | null
  qrCode: string | null
  createdAt: string
  updatedAt: string
}

export interface Seat {
  id: number
  seatNumber: string
  row: string
  section: string
  price: number
  status: 'AVAILABLE' | 'HELD' | 'BOOKED'
  bookingId: number | null
}

export interface HoldBookingRequest {
  showId: number
  seatIds: number[]
  idempotencyKey: string
}

export const bookingApi = {
  holdSeats: async (showId: number, seatIds: number[], idempotencyKey: string) => {
    const { data } = await api.post('/bookings/hold', {
      showId,
      seatIds,
      idempotencyKey,
    })
    return data
  },

  getBooking: async (id: number) => {
    const { data } = await api.get(`/bookings/${id}`)
    return data
  },

  cancelBooking: async (id: number) => {
    const { data } = await api.post(`/bookings/${id}/cancel`)
    return data
  },

  listMyBookings: async (params?: { page?: number; limit?: number; status?: string }) => {
    const { data } = await api.get('/bookings', { params })
    return data
  },
}
