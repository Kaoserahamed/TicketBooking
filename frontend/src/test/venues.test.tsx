import { describe, expect, it, vi, beforeEach } from 'vitest'
import api from '../api/client'
import { venueApi } from '../api/venues'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  const post = vi.fn()
  const get = vi.fn()
  const put = vi.fn()
  return { ...actual, default: { post, get, put } }
})

const mockedApi = vi.mocked(api, true)

const venue = {
  id: 2,
  name: 'Grand Hall',
  address: '1 Main St',
  city: 'Dhaka',
  capacity: 500,
  createdAt: '2026-01-01T00:00:00.000Z',
  seats: {
    total: 3,
    byType: { VIP: 1, PREMIUM: 1, REGULAR: 1, BALCONY: 0, BOX: 0 },
  },
}

const seat = {
  id: 20,
  venueId: 2,
  row: 'A',
  number: '1',
  label: 'A1',
  seatType: 'VIP',
  createdAt: '2026-01-01T00:00:00.000Z',
}

// STEP 5 — venues service frontend (docs/04-api-design.md §4.x).
// Backend already implements GET /venues, /venues/:id, /venues/:id/seats.
// These tests pin the frontend to the real envelope + query contract.
describe('venues service frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists venues with city/search/limit/offset and unwraps the envelope', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { status: 'ok', venues: [venue], total: 1, limit: 12, offset: 0 },
    })
    const result = await venueApi.listVenues({
      city: 'Dhaka',
      search: 'hall',
      limit: 12,
      offset: 0,
    })
    expect(mockedApi.get).toHaveBeenCalledWith('/venues', {
      params: { city: 'Dhaka', search: 'hall', limit: 12, offset: 0 },
    })
    expect(result.total).toBe(1)
    expect(result.venues[0]?.name).toBe('Grand Hall')
  })

  it('drops empty filters so the backend validator never sees city=/search=', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { status: 'ok', venues: [], total: 0, limit: 12, offset: 0 },
    })
    await venueApi.listVenues({ city: '', search: '', limit: 12, offset: 0 })
    expect(mockedApi.get).toHaveBeenCalledWith('/venues', {
      params: { limit: 12, offset: 0 },
    })
  })

  it('fetches one venue and unwraps { venue } with the seat summary', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { status: 'ok', venue } })
    const result = await venueApi.getVenue(2)
    expect(mockedApi.get).toHaveBeenCalledWith('/venues/2')
    expect(result.id).toBe(2)
    expect(result.seats?.total).toBe(3)
    expect(result.seats?.byType.VIP).toBe(1)
  })

  it('fetches venue seats with the seatType filter', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { status: 'ok', venueId: 2, seats: [seat], total: 1, limit: 100, offset: 0 },
    })
    const result = await venueApi.listSeats(2, { seatType: 'VIP', limit: 100 })
    expect(mockedApi.get).toHaveBeenCalledWith('/venues/2/seats', {
      params: { seatType: 'VIP', limit: 100 },
    })
    expect(result.seats[0]?.label).toBe('A1')
    expect(result.seats[0]?.seatType).toBe('VIP')
  })
})
