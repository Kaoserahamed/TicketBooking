import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { eventApi } from '../api/events'
import { showApi } from '../api/shows'

vi.mock('../api/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/events')>()
  return {
    ...actual,
    eventApi: {
      listEvents: vi.fn(),
      getEvent: vi.fn(),
      getEventShows: vi.fn(),
    },
  }
})

vi.mock('../api/shows', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/shows')>()
  return {
    ...actual,
    showApi: {
      listShows: vi.fn(),
      getShow: vi.fn(),
      getSeatMap: vi.fn(),
      getAvailability: vi.fn(),
    },
  }
})

const mockedEventApi = vi.mocked(eventApi, true)
const mockedShowApi = vi.mocked(showApi, true)

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
  event: { id: 3, name: 'Rock Night', status: 'PUBLISHED' },
  venueId: 2,
  venue: { id: 2, name: 'Grand Hall', address: '1 Main St', city: 'Dhaka', capacity: 500 },
  startTime: '2026-02-01T18:00:00.000Z',
  endTime: '2026-02-01T20:00:00.000Z',
  status: 'SCHEDULED',
  createdAt: '2026-01-01T00:00:00.000Z',
  seats: { total: 120, available: 90, held: 10, booked: 20, blocked: 0 },
}

// HomePage no longer uses dummy content — it pulls real data from the
// public backend endpoints GET /events and GET /shows?upcoming=true.
describe('home page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedEventApi.listEvents.mockResolvedValue({
      status: 'ok',
      events: [event],
      total: 1,
      limit: 6,
      offset: 0,
    })
    mockedShowApi.listShows.mockResolvedValue({
      status: 'ok',
      shows: [show],
      total: 1,
      limit: 6,
      offset: 0,
    })
  })

  it('fetches featured events and upcoming shows and links to their pages', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    expect(mockedEventApi.listEvents).toHaveBeenCalledWith({ limit: 6 })
    expect(mockedShowApi.listShows).toHaveBeenCalledWith({ upcoming: true, limit: 6 })

    expect(await screen.findByRole('heading', { name: 'Featured events' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Upcoming shows' })).toBeInTheDocument()
    // "Rock Night" appears both as an event card and as the show row title.
    const rockNightLinks = screen.getAllByRole('link', { name: 'Rock Night' })
    const hrefs = rockNightLinks.map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/events/3')
    expect(hrefs).toContain('/shows/11')
    expect(screen.getByRole('link', { name: 'View show' })).toHaveAttribute('href', '/shows/11')
    expect(screen.getByText(/Grand Hall/)).toHaveTextContent('Grand Hall, Dhaka ·')
    expect(screen.getByText(/tickets available/)).toHaveTextContent('90 tickets available')
  })

  it('shows empty-state copy when the backend has no published content', async () => {
    mockedEventApi.listEvents.mockResolvedValueOnce({
      status: 'ok',
      events: [],
      total: 0,
      limit: 6,
      offset: 0,
    })
    mockedShowApi.listShows.mockResolvedValueOnce({
      status: 'ok',
      shows: [],
      total: 0,
      limit: 6,
      offset: 0,
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    expect(await screen.findByText('No events published yet.')).toBeInTheDocument()
    expect(screen.getByText('No upcoming shows scheduled.')).toBeInTheDocument()
  })

  it('shows a backend error when the public endpoints fail', async () => {
    mockedEventApi.listEvents.mockRejectedValueOnce({
      response: { data: { message: 'Database unavailable' } },
    })
    mockedShowApi.listShows.mockResolvedValueOnce({
      status: 'ok',
      shows: [],
      total: 0,
      limit: 6,
      offset: 0,
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Database unavailable')
    })
  })
})
