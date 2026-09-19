import { describe, expect, it, vi, beforeEach } from 'vitest'
import api from '../api/client'
import { showApi } from '../api/shows'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  const post = vi.fn()
  const get = vi.fn()
  const put = vi.fn()
  return { ...actual, default: { post, get, put } }
})

const mockedApi = vi.mocked(api, true)

const show = {
  id: 11,
  eventId: 3,
  event: { id: 3, name: 'Rock Night', status: 'PUBLISHED' },
  venueId: 2,
  venue: { id: 2, name: 'Grand Hall', address: '1 Main St', city: 'Dhaka', capacity: 500 },
  startTime: '2026-02-01T18:00:00.000Z',
  endTime: '2026-02-01T20:00:00.000Z',
  status: 'SCHEDULED',
  createdAt: '2026-01-01T00:00:00.000Z',
  seats: { total: 4, available: 2, held: 1, booked: 1, blocked: 0 },
}

const seat = {
  showSeatId: 101,
  showId: 11,
  seatId: 1,
  row: 'A',
  number: '1',
  label: 'A1',
  seatType: 'REGULAR',
  price: '100.00',
  status: 'AVAILABLE' as const,
  holdExpiresAt: null,
}

const availability = {
  showId: 11,
  total: 4,
  available: 2,
  held: 1,
  booked: 1,
  blocked: 0,
  byRow: [{ row: 'A', total: 4, available: 2, held: 1, booked: 1, blocked: 0 }],
}

// STEP 3 — shows/seats service frontend (docs/04-api-design.md §4.4).
// Backend already implements GET /shows, /shows/:id, /:id/seats, /:id/availability.
// These tests pin the frontend to the real envelope/query contract.
describe('shows service frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists shows with eventId/status/upcoming/limit/offset', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { status: 'ok', shows: [show], total: 1, limit: 20, offset: 0 },
    })
    const result = await showApi.listShows({ eventId: 3, status: 'SCHEDULED', upcoming: true })
    expect(mockedApi.get).toHaveBeenCalledWith('/shows', {
      params: { eventId: 3, status: 'SCHEDULED', upcoming: true },
    })
    expect(result.shows[0]?.event.name).toBe('Rock Night')
  })

  it('fetches one show and unwraps { show }', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { status: 'ok', show } })
    const result = await showApi.getShow(11)
    expect(mockedApi.get).toHaveBeenCalledWith('/shows/11')
    expect(result.venue.name).toBe('Grand Hall')
  })

  it('fetches the seat map envelope { showId, total, seats }', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { status: 'ok', showId: 11, total: 1, seats: [seat] },
    })
    const result = await showApi.getSeatMap(11)
    expect(mockedApi.get).toHaveBeenCalledWith('/shows/11/seats')
    expect(result.seats[0]?.label).toBe('A1')
  })

  it('fetches availability and unwraps { availability }', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { status: 'ok', availability } })
    const result = await showApi.getAvailability(11)
    expect(mockedApi.get).toHaveBeenCalledWith('/shows/11/availability')
    expect(result.byRow[0]?.row).toBe('A')
  })
})
