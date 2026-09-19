import { describe, expect, it, vi, beforeEach } from 'vitest'
import api from '../api/client'
import { bookingApi } from '../api/bookings'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  const post = vi.fn()
  const get = vi.fn()
  const put = vi.fn()
  return { ...actual, default: { post, get, put } }
})

const mockedApi = vi.mocked(api, true)

const booking = {
  id: 5,
  userId: 7,
  showId: 11,
  bookingReference: 'BK-ABC123',
  idempotencyKey: 'key-1',
  status: 'PENDING' as const,
  subtotal: 200,
  discount: 0,
  totalAmount: 200,
  currency: 'USD',
  expiresAt: '2026-02-01T18:10:00.000Z',
  createdAt: '2026-02-01T18:00:00.000Z',
  updatedAt: '2026-02-01T18:00:00.000Z',
  show: {
    id: 11,
    eventId: 3,
    venueId: 2,
    startTime: '2026-02-01T18:00:00.000Z',
    endTime: '2026-02-01T20:00:00.000Z',
    status: 'SCHEDULED',
    event: { id: 3, name: 'Rock Night', status: 'PUBLISHED' },
    venue: { id: 2, name: 'Grand Hall', address: '1 Main St', city: 'Dhaka', capacity: 500 },
  },
  user: { id: 7, name: 'Asha Example', email: 'asha@example.com' },
  items: [
    { id: 1, bookingId: 5, showSeatId: 101, seat: { id: 1, row: 'A', number: '1', label: 'A1', seatType: 'REGULAR' }, price: 100 },
    { id: 2, bookingId: 5, showSeatId: 102, seat: { id: 2, row: 'A', number: '2', label: 'A2', seatType: 'REGULAR' }, price: 100 },
  ],
}

// STEP 4 — booking service frontend (docs/04-api-design.md §4.5).
// Backend already implements hold/detail/cancel/list. These tests pin the
// frontend to the real body + envelope contract.
describe('booking service frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('holds seats with showId/seatIds/idempotencyKey and unwraps the envelope', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { status: 'ok', booking, items: booking.items, idempotentReplay: false },
    })
    const result = await bookingApi.holdSeats({ showId: 11, seatIds: [1, 2], idempotencyKey: 'key-1' })
    expect(mockedApi.post).toHaveBeenCalledWith('/bookings/hold', {
      showId: 11,
      seatIds: [1, 2],
      idempotencyKey: 'key-1',
    })
    expect(result.booking.bookingReference).toBe('BK-ABC123')
    expect(result.idempotentReplay).toBe(false)
  })

  it('fetches one booking and unwraps { booking, items }', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { status: 'ok', booking, items: booking.items },
    })
    const result = await bookingApi.getBooking(5)
    expect(mockedApi.get).toHaveBeenCalledWith('/bookings/5')
    expect(result.items).toHaveLength(2)
  })

  it('cancels a booking and returns released + message', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { status: 'ok', booking: { ...booking, status: 'CANCELLED' }, items: booking.items, released: 2, message: 'Booking cancelled and seats released' },
    })
    const result = await bookingApi.cancelBooking(5)
    expect(mockedApi.post).toHaveBeenCalledWith('/bookings/5/cancel')
    expect(result.released).toBe(2)
  })

  it('lists my bookings with status/limit/offset', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { status: 'ok', total: 1, bookings: [booking] },
    })
    const result = await bookingApi.listMyBookings({ status: 'PENDING', limit: 10, offset: 0 })
    expect(mockedApi.get).toHaveBeenCalledWith('/bookings', {
      params: { status: 'PENDING', limit: 10, offset: 0 },
    })
    expect(result.total).toBe(1)
  })
})
