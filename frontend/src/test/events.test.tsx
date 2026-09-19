import { describe, expect, it, vi, beforeEach } from 'vitest'
import api from '../api/client'
import { eventApi } from '../api/events'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  const post = vi.fn()
  const get = vi.fn()
  const put = vi.fn()
  return { ...actual, default: { post, get, put } }
})

const mockedApi = vi.mocked(api, true)

const event = {
  id: 3,
  name: 'Rock Night',
  description: 'Live rock concert',
  category: 'Music',
  posterUrl: null,
  status: 'PUBLISHED',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}

const show = {
  id: 11,
  eventId: 3,
  venueId: 2,
  venue: { id: 2, name: 'Grand Hall', address: '1 Main St', city: 'Dhaka', capacity: 500 },
  startTime: '2026-02-01T18:00:00.000Z',
  endTime: '2026-02-01T20:00:00.000Z',
  status: 'SCHEDULED',
  createdAt: '2026-01-01T00:00:00.000Z',
}

// STEP 2 — events service frontend (docs/04-api-design.md §4.3).
// Backend already implements GET /events, /events/:id, /events/:id/shows.
// These tests pin the frontend to the real envelope + query contract.
describe('events service frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists events with search/category/limit/offset and unwraps the envelope', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { status: 'ok', events: [event], total: 1, limit: 12, offset: 0 },
    })
    const result = await eventApi.listEvents({
      search: 'rock',
      category: 'Music',
      limit: 12,
      offset: 0,
    })
    expect(mockedApi.get).toHaveBeenCalledWith('/events', {
      params: { search: 'rock', category: 'Music', limit: 12, offset: 0 },
    })
    expect(result.total).toBe(1)
    expect(result.events[0]?.name).toBe('Rock Night')
  })

  it('drops empty filters so the backend validator never sees search=/category=', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { status: 'ok', events: [], total: 0, limit: 12, offset: 0 },
    })
    await eventApi.listEvents({ search: '', category: '', limit: 12, offset: 0 })
    expect(mockedApi.get).toHaveBeenCalledWith('/events', {
      params: { limit: 12, offset: 0 },
    })
  })

  it('fetches one event and unwraps { event }', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { status: 'ok', event } })
    const result = await eventApi.getEvent(3)
    expect(mockedApi.get).toHaveBeenCalledWith('/events/3')
    expect(result.id).toBe(3)
  })

  it('fetches shows for an event with paging', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { status: 'ok', eventId: 3, shows: [show], total: 1, limit: 50, offset: 0 },
    })
    const result = await eventApi.getEventShows(3, { limit: 50 })
    expect(mockedApi.get).toHaveBeenCalledWith('/events/3/shows', {
      params: { limit: 50 },
    })
    expect(result.shows[0]?.venue.name).toBe('Grand Hall')
  })
})
