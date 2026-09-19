import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { eventApi } from '../api/events'

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

const mockedEventApi = vi.mocked(eventApi, true)

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

describe('events pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the catalogue, searches, and paginates', async () => {
    const userAction = userEvent.setup()
    mockedEventApi.listEvents
      .mockResolvedValueOnce({
        status: 'ok',
        events: [event],
        total: 13,
        limit: 12,
        offset: 0,
      })
      .mockResolvedValueOnce({
        status: 'ok',
        events: [],
        total: 0,
        limit: 12,
        offset: 0,
      })

    render(
      <MemoryRouter initialEntries={['/events']}>
        <App />
      </MemoryRouter>
    )

    expect(await screen.findByRole('link', { name: 'Rock Night' })).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2 (13 events)')).toBeInTheDocument()

    await userAction.clear(screen.getByLabelText('Search events'))
    await userAction.type(screen.getByLabelText('Search events'), 'rock')
    await userAction.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(mockedEventApi.listEvents).toHaveBeenLastCalledWith({
        search: 'rock',
        category: undefined,
        limit: 12,
        offset: 0,
      })
    })
    expect(await screen.findByText('No events found.')).toBeInTheDocument()
  })

  it('renders one event with its shows and links to the show page', async () => {
    mockedEventApi.getEvent.mockResolvedValueOnce(event)
    mockedEventApi.getEventShows.mockResolvedValueOnce({
      status: 'ok',
      eventId: 3,
      shows: [show],
      total: 1,
      limit: 50,
      offset: 0,
    })

    render(
      <MemoryRouter initialEntries={['/events/3']}>
        <App />
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: 'Rock Night' })).toBeInTheDocument()
    expect(screen.getByText('Grand Hall')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View show' })).toHaveAttribute('href', '/shows/11')
  })

  it('shows backend errors on the detail page', async () => {
    mockedEventApi.getEvent.mockRejectedValueOnce({
      response: { data: { message: 'Event not found' } },
    })
    mockedEventApi.getEventShows.mockResolvedValueOnce({
      status: 'ok',
      eventId: 3,
      shows: [],
      total: 0,
      limit: 50,
      offset: 0,
    })

    render(
      <MemoryRouter initialEntries={['/events/999']}>
        <App />
      </MemoryRouter>
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Event not found')
  })
})
